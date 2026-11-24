import mongoose from "mongoose";

import Order from "../models/Order.model.js";
import Game from "../models/Game.model.js";
import User from "../models/User.model.js";

import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import generateOrderNumber from "../utils/generateOrderNumber.js";
import { sendEmail } from "../services/email.service.js";
import orderConfirmationEmailTemplate from "../templates/orderConfirmationEmail.template.js";
import orderCancellationEmailTemplate from "../templates/orderCancellationEmail.template.js";

const parsePagination = (query, defaultLimit, maxLimit) => {
  const parsePositiveInteger = (value, field, defaultValue) => {
    if (value === undefined) {
      return defaultValue;
    }

    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
      throw new ApiError(400, `${field} must be a positive integer`);
    }

    const parsedValue = Number(value);

    if (!Number.isSafeInteger(parsedValue)) {
      throw new ApiError(400, `${field} must be a valid positive integer`);
    }

    return parsedValue;
  };

  const page = parsePositiveInteger(query.page, "Page", 1);

  const requestedLimit = parsePositiveInteger(
    query.limit,
    "Limit",
    defaultLimit,
  );

  return {
    page,
    limit: Math.min(requestedLimit, maxLimit),
  };
};

const sanitizeOrderResponse = (order) => {
  const safeOrder = order.toObject ? order.toObject() : { ...order };

  delete safeOrder.idempotencyKey;
  delete safeOrder.__v;

  return safeOrder;
};

export const placeOrder = asyncHandler(async (req, res) => {
  const idempotencyKey = req.headers["idempotency-key"];

  if (
    !idempotencyKey ||
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length < 16 ||
    idempotencyKey.trim().length > 128
  ) {
    throw new ApiError(400, "A valid Idempotency-Key header is required");
  }

  const normalizedKey = idempotencyKey.trim();
  const requestedGameId = req.body?.gameId;
  const isBuyNow = requestedGameId !== undefined;

  if (
    isBuyNow &&
    (typeof requestedGameId !== "string" ||
      !mongoose.Types.ObjectId.isValid(requestedGameId))
  ) {
    throw new ApiError(400, "A valid game ID is required");
  }

  const existingOrder = await Order.findOne({
    user: req.user._id,
    idempotencyKey: normalizedKey,
  });

  if (existingOrder) {
    return res.status(200).json(
      new ApiResponse(200, "Existing order returned", {
        order: sanitizeOrderResponse(existingOrder),
      }),
    );
  }
  const session = await mongoose.startSession();

  let createdOrder;

  try {
    await session.withTransaction(async () => {
      // 1. Find the authenticated user's cart
      const user = await User.findOneAndUpdate(
        { _id: req.user._id },
        {
          $inc: {
            checkoutVersion: 1,
          },
        },
        {
          new: true,
          session,
        },
      ).select("cart activeCheckoutOrder");

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      // Check whether the customer already has an active checkout.
      if (user.activeCheckoutOrder) {
        const activeOrder = await Order.findOne({
          _id: user.activeCheckoutOrder,
          user: user._id,
        }).session(session);

        if (
          activeOrder &&
          activeOrder.orderStatus === "pending" &&
          activeOrder.paymentStatus === "pending"
        ) {
          throw new ApiError(
            409,
            "You already have an active pending order. Please complete or cancel that order before creating another.",
          );
        }

        // Clear stale active-order references.
        await User.updateOne(
          {
            _id: user._id,
            activeCheckoutOrder: user.activeCheckoutOrder,
          },
          {
            $set: {
              activeCheckoutOrder: null,
            },
          },
          { session },
        );
      }

      const cartGameIds = isBuyNow
        ? [new mongoose.Types.ObjectId(requestedGameId)]
        : user.cart;

      if (!cartGameIds || cartGameIds.length === 0) {
        throw new ApiError(400, "Your cart is empty");
      }

      // 2. Fetch only published games from the database
      const games = await Game.find({
        _id: { $in: cartGameIds },
        status: "published",
      })
        .select("title slug coverImage price discountPrice status")
        .session(session);

      if (games.length !== cartGameIds.length) {
        throw new ApiError(
          409,
          "One or more games in your cart are unavailable",
        );
      }

      // 3. Create order items using database prices
      const gameMap = new Map(games.map((game) => [game._id.toString(), game]));

      const orderItems = cartGameIds.map((gameId) => {
        const game = gameMap.get(gameId.toString());

        const finalPrice =
          game.discountPrice !== null ? game.discountPrice : game.price;

        return {
          game: game._id,
          title: game.title,
          slug: game.slug,
          coverImage: game.coverImage,
          price: game.price,
          discountPrice: game.discountPrice,
          finalPrice,
        };
      });

      // 4. Calculate totals on the server
      const subtotal = orderItems.reduce(
        (total, item) => total + item.price,
        0,
      );

      const totalAmount = orderItems.reduce(
        (total, item) => total + item.finalPrice,
        0,
      );

      const roundMoney = (amount) =>
        Math.round((amount + Number.EPSILON) * 100) / 100;

      const roundedSubtotal = roundMoney(subtotal);
      const roundedTotalAmount = roundMoney(totalAmount);

      const totalDiscount = roundMoney(roundedSubtotal - roundedTotalAmount);

      // 5. Create the pending order
      const orderNumber = generateOrderNumber();

      const [order] = await Order.create(
        [
          {
            orderNumber,
            idempotencyKey: normalizedKey,
            user: user._id,
            items: orderItems,
            subtotal: roundedSubtotal,
            totalDiscount,
            totalAmount: roundedTotalAmount,
            orderStatus: "pending",
            paymentStatus: "pending",
          },
        ],
        { session },
      );

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            activeCheckoutOrder: order._id,
          },
        },
        { session },
      );

      createdOrder = order;
    });

    // 6. Send order confirmation email after transaction commits
    try {
      const customer = await User.findById(req.user._id).select(
        "fullName email",
      );

      if (customer?.email) {
        const orderEmail = orderConfirmationEmailTemplate({
          name: customer.fullName,
          orderNumber: createdOrder.orderNumber,
          items: createdOrder.items,
          totalAmount: createdOrder.totalAmount,
          orderUrl: `${process.env.FRONTEND_URL?.replace(/\/+$/, "")}/my-orders`,
        });

        await sendEmail({
          to: customer.email,
          ...orderEmail,
        });

        console.log(`Order confirmation email sent to ${customer.email}`);
      }
    } catch (error) {
      console.error("Order confirmation email failed:", error.message);
    }

    // 7. Return the successfully created order
    return res.status(201).json(
      new ApiResponse(201, "Order created successfully. Awaiting payment.", {
        order: sanitizeOrderResponse(createdOrder),
      }),
    );
  } catch (error) {
    if (error.code === 11000) {
      // Check whether this was a duplicate checkout request
      const existingOrder = await Order.findOne({
        user: req.user._id,
        idempotencyKey: normalizedKey,
      });

      if (existingOrder) {
        return res.status(200).json(
          new ApiResponse(200, "Existing order returned", {
            order: sanitizeOrderResponse(existingOrder),
          }),
        );
      }

      // Otherwise, it may be an order number collision
      throw new ApiError(409, "Order number collision. Please try again.");
    }

    throw error;
  } finally {
    await session.endSession();
  }
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query, 10, 20);
  const skip = (page - 1) * limit;

  const [orders, totalOrders] = await Promise.all([
    Order.find({ user: req.user._id })
      .select("-__v -idempotencyKey")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Order.countDocuments({ user: req.user._id }),
  ]);

  return res.status(200).json(
    new ApiResponse(200, "Order history fetched successfully", {
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        limit,
        hasNextPage: page * limit < totalOrders,
        hasPreviousPage: page > 1,
      },
    }),
  );
});

export const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  }).select("-__v -idempotencyKey");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  return res.status(200).json(
    new ApiResponse(200, "Order details fetched successfully", {
      order,
    }),
  );
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  // First, verify that this order belongs to the logged-in user.
  const existingOrder = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  }).select("orderStatus paymentStatus");

  if (!existingOrder) {
    throw new ApiError(404, "Order not found");
  }

  if (existingOrder.orderStatus === "cancelled") {
    throw new ApiError(409, "Order is already cancelled");
  }

  if (!["pending", "confirmed"].includes(existingOrder.orderStatus)) {
    throw new ApiError(400, "This order cannot be cancelled");
  }

  if (existingOrder.paymentStatus === "paid") {
    throw new ApiError(409, "This order requires a refund before cancellation");
  }

  // Atomically cancel only if the order is still eligible.
  const cancelledOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      user: req.user._id,
      orderStatus: { $in: ["pending", "confirmed"] },
      paymentStatus: { $ne: "paid" },
    },
    {
      $set: {
        orderStatus: "cancelled",
        cancelledAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  // If the update failed, check the latest database state.
  if (!cancelledOrder) {
    const latestOrder = await Order.findOne({
      _id: orderId,
      user: req.user._id,
    }).select("orderStatus paymentStatus");

    if (!latestOrder) {
      throw new ApiError(404, "Order not found");
    }

    if (latestOrder.orderStatus === "cancelled") {
      throw new ApiError(409, "Order is already cancelled");
    }

    if (latestOrder.paymentStatus === "paid") {
      throw new ApiError(
        409,
        "This order requires a refund before cancellation",
      );
    }

    throw new ApiError(
      409,
      "Order changed while cancellation was being processed. Please refresh and try again.",
    );
  }

  // Clear the active checkout reference if it points to this order.
  await User.updateOne(
    {
      _id: req.user._id,
      activeCheckoutOrder: cancelledOrder._id,
    },
    {
      $set: {
        activeCheckoutOrder: null,
      },
    },
  );

  // Send order cancellation email
  try {
    const customer = await User.findById(req.user._id).select("fullName email");

    if (customer?.email) {
      const cancellationEmail = orderCancellationEmailTemplate({
        name: customer.fullName,
        orderNumber: cancelledOrder.orderNumber,
        items: cancelledOrder.items,
        totalAmount: cancelledOrder.totalAmount,
      });

      await sendEmail({
        to: customer.email,
        ...cancellationEmail,
      });

      console.log(`Order cancellation email sent to ${customer.email}`);
    }
  } catch (error) {
    console.error("Order cancellation email failed:", error.message);
  }

  return res.status(200).json(
    new ApiResponse(200, "Order cancelled successfully", {
      order: sanitizeOrderResponse(cancelledOrder),
    }),
  );
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query, 10, 50);
  const skip = (page - 1) * limit;

  const allowedStatuses = [
    "pending",
    "confirmed",
    "processing",
    "completed",
    "cancelled",
    "failed",
  ];

  const query = {};

  if (
    Object.keys(req.query).some(
      (key) => key.startsWith("search[") || key === "search[]",
    )
  ) {
    throw new ApiError(400, "Invalid search parameter");
  }

  if (req.query.search !== undefined) {
    if (typeof req.query.search !== "string") {
      throw new ApiError(400, "Search must be a valid string");
    }

    const search = req.query.search.trim();

    if (search.length > 64) {
      throw new ApiError(400, "Search cannot exceed 64 characters");
    }

    if (search) {
      // Escape regex special characters to ensure literal matching.
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      query.orderNumber = {
        $regex: escapedSearch,
        $options: "i",
      };
    }
  }

  if (
    Object.keys(req.query).some(
      (key) => key.startsWith("status[") || key === "status[]",
    )
  ) {
    throw new ApiError(400, "Invalid status parameter");
  }

  if (req.query.status !== undefined) {
    if (typeof req.query.status !== "string") {
      throw new ApiError(400, "Order status must be a valid string");
    }

    const status = req.query.status.trim().toLowerCase();

    if (!allowedStatuses.includes(status)) {
      throw new ApiError(400, "Invalid order status");
    }

    query.orderStatus = status;
  }

  const [orders, totalOrders] = await Promise.all([
    Order.find(query)
      .populate("user", "fullName email")
      .select("-__v -idempotencyKey")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Order.countDocuments(query),
  ]);

  return res.status(200).json(
    new ApiResponse(200, "Orders fetched successfully", {
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        limit,
        hasNextPage: page * limit < totalOrders,
        hasPreviousPage: page > 1,
      },
    }),
  );
});

export const getAdminOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const order = await Order.findById(orderId)
    .populate("user", "fullName email")
    .select("-__v -idempotencyKey");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  return res.status(200).json(
    new ApiResponse(200, "Order details fetched successfully", {
      order,
    }),
  );
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { orderStatus } = req.body;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order ID");
  }

  const allowedTransitions = {
    pending: ["confirmed", "cancelled", "failed"],
    confirmed: ["processing", "cancelled"],
    processing: ["completed"],
    completed: [],
    cancelled: [],
    failed: [],
  };

  const allowedStatuses = Object.keys(allowedTransitions);

  if (!allowedStatuses.includes(orderStatus)) {
    throw new ApiError(400, "Invalid order status");
  }

  // Fetch the current order state.
  const existingOrder = await Order.findById(orderId);

  if (!existingOrder) {
    throw new ApiError(404, "Order not found");
  }

  // Validate the requested transition.
  if (!allowedTransitions[existingOrder.orderStatus].includes(orderStatus)) {
    throw new ApiError(
      400,
      `Cannot change order status from ${existingOrder.orderStatus} to ${orderStatus}`,
    );
  }

  // Orders must be paid before confirmation, processing or completion.
  if (
    ["confirmed", "processing", "completed"].includes(orderStatus) &&
    existingOrder.paymentStatus !== "paid"
  ) {
    throw new ApiError(
      400,
      "Order must be paid before confirmation or processing",
    );
  }

  // Paid orders require a refund before cancellation.
  if (orderStatus === "cancelled" && existingOrder.paymentStatus === "paid") {
    throw new ApiError(409, "This order requires a refund before cancellation");
  }

  const updateFields = {
    orderStatus,
  };

  if (orderStatus === "cancelled") {
    updateFields.cancelledAt = new Date();
  }

  // Atomically update only if the order still has the state we checked.
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      orderStatus: existingOrder.orderStatus,
      paymentStatus: existingOrder.paymentStatus,
    },
    {
      $set: updateFields,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  // Another operation may have changed the order in the meantime.
  if (!updatedOrder) {
    throw new ApiError(
      409,
      "Order changed while this request was being processed. Please refresh and try again.",
    );
  }

  // Clear active checkout tracking when an order is cancelled or failed.
  if (["cancelled", "failed"].includes(updatedOrder.orderStatus)) {
    await User.updateOne(
      {
        _id: updatedOrder.user,
        activeCheckoutOrder: updatedOrder._id,
      },
      {
        $set: {
          activeCheckoutOrder: null,
        },
      },
    );
  }

  // Send cancellation email when an admin cancels an order.
  if (updatedOrder.orderStatus === "cancelled") {
    try {
      const customer = await User.findById(updatedOrder.user).select(
        "fullName email",
      );

      if (customer?.email) {
        const cancellationEmail = orderCancellationEmailTemplate({
          name: customer.fullName,
          orderNumber: updatedOrder.orderNumber,
          items: updatedOrder.items,
          totalAmount: updatedOrder.totalAmount,
        });

        await sendEmail({
          to: customer.email,
          ...cancellationEmail,
        });

        console.log(`Admin cancellation email sent to ${customer.email}`);
      }
    } catch (error) {
      console.error("Admin cancellation email failed:", error.message);
    }
  }

  return res.status(200).json(
    new ApiResponse(200, "Order status updated successfully", {
      order: sanitizeOrderResponse(updatedOrder),
    }),
  );
});

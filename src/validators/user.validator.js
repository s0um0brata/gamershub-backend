import { body } from "express-validator";

export const updateProfileValidation = [
  body("fullName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Full name cannot be empty"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email"),

  body("phoneNumber")
    .optional({ values: "falsy" })
    .trim()
    .isMobilePhone("en-IN")
    .withMessage("Please enter a valid Indian mobile number"),
];

export const changePasswordValidation = [
  body("oldPassword").notEmpty().withMessage("Current password is required"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
];

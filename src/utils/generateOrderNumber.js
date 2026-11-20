import { randomBytes } from "crypto";

const generateOrderNumber = () => {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const datePart = `${year}${month}${day}`;

  const randomPart = randomBytes(4).toString("hex").toUpperCase();

  return `GH-${datePart}-${randomPart}`;
};

export default generateOrderNumber;

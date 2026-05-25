import type {
  CartDeliveryOptionsTransformRunInput,
  CartDeliveryOptionsTransformRunResult,
} from "../generated/api";

const NO_CHANGES: CartDeliveryOptionsTransformRunResult = {
  operations: [],
};

const EU_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

export function cartDeliveryOptionsTransformRun(
  input: CartDeliveryOptionsTransformRunInput,
): CartDeliveryOptionsTransformRunResult {
  const operations: CartDeliveryOptionsTransformRunResult["operations"] = [];

  for (const group of input.cart.deliveryGroups) {
    const countryCode = group.deliveryAddress?.countryCode;
    if (!countryCode || !EU_COUNTRIES.has(countryCode)) continue;

    // All products in this shop are fulfilled by Printful, no vendor check needed

    const freeOptions = group.deliveryOptions.filter(
      (opt) => parseFloat(opt.cost.amount) === 0,
    );

    if (freeOptions.length === 0) continue;

    const paidOptions = group.deliveryOptions.filter(
      (opt) => parseFloat(opt.cost.amount) > 0,
    );

    for (const opt of paidOptions) {
      operations.push({
        deliveryOptionHide: { deliveryOptionHandle: opt.handle },
      });
    }
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}

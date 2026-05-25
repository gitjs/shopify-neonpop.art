import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const FUNCTION_HANDLE = "checkout-free-shipping";
const CUSTOMIZATION_TITLE = "Kostenloser Versand EU (Printful)";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ admin }) => {
      const functionsRes = await admin.graphql(`#graphql
        query {
          shopifyFunctions(first: 25) {
            nodes { id handle }
          }
          deliveryCustomizations(first: 25) {
            edges {
              node { id functionId }
            }
          }
        }
      `);
      const { data } = await functionsRes.json();

      const fn = (data.shopifyFunctions.nodes as { id: string; handle: string }[])
        .find((f) => f.handle === FUNCTION_HANDLE);
      if (!fn) return;

      const alreadyExists = (
        data.deliveryCustomizations.edges as { node: { id: string; functionId: string } }[]
      ).some((e) => e.node.functionId === fn.id);
      if (alreadyExists) return;

      await admin.graphql(
        `#graphql
          mutation CreateDeliveryCustomization($input: DeliveryCustomizationInput!) {
            deliveryCustomizationCreate(deliveryCustomization: $input) {
              deliveryCustomization { id }
              userErrors { field message }
            }
          }
        `,
        {
          variables: {
            input: { functionId: fn.id, title: CUSTOMIZATION_TITLE, enabled: true },
          },
        },
      );
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

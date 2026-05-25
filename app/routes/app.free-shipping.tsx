import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

const CUSTOMIZATION_TITLE = "Kostenloser Versand EU (Printful)";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(`#graphql
      query {
        shopifyFunctions(first: 1) {
          nodes {
            id
          }
        }
        deliveryCustomizations(first: 25) {
          edges {
            node {
              id
              title
              enabled
              functionId
            }
          }
        }
      }
    `);

    const json = await response.json();
    console.log("[free-shipping] graphql response:", JSON.stringify(json, null, 2));

    const { data } = json;

    if (!data?.shopifyFunctions || !data?.deliveryCustomizations) {
      console.warn("[free-shipping] missing shopifyFunctions or deliveryCustomizations in response");
      return { functionId: null, customization: null };
    }

    const ourFunction = (data.shopifyFunctions.nodes as { id: string }[])[0] ?? null;
    console.log("[free-shipping] function:", ourFunction ?? "none");

    const customization = ourFunction
      ? (data.deliveryCustomizations.edges as { node: { id: string; title: string; enabled: boolean; functionId: string } }[])
          .map((e) => e.node)
          .find((c) => c.functionId === ourFunction.id) ?? null
      : null;
    console.log("[free-shipping] customization:", customization ?? "none");

    return { functionId: ourFunction?.id ?? null, customization };
  } catch (error) {
    console.error("[free-shipping] loader error:", error instanceof Error ? error.stack : error);
    return { functionId: null, customization: null };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "enable") {
    const functionId = formData.get("functionId") as string;
    const res = await admin.graphql(
      `#graphql
        mutation CreateDeliveryCustomization($input: DeliveryCustomizationInput!) {
          deliveryCustomizationCreate(deliveryCustomization: $input) {
            deliveryCustomization {
              id
              enabled
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          input: {
            functionId,
            title: CUSTOMIZATION_TITLE,
            enabled: true,
          },
        },
      },
    );
    const { data } = await res.json();
    const errors = data?.deliveryCustomizationCreate?.userErrors ?? [];
    if (errors.length > 0) {
      return { errors };
    }
  } else if (intent === "disable") {
    const customizationId = formData.get("customizationId") as string;
    const res = await admin.graphql(
      `#graphql
        mutation DeleteDeliveryCustomization($id: ID!) {
          deliveryCustomizationDelete(id: $id) {
            deletedId
            userErrors {
              field
              message
            }
          }
        }
      `,
      { variables: { id: customizationId } },
    );
    const { data } = await res.json();
    const errors = data?.deliveryCustomizationDelete?.userErrors ?? [];
    if (errors.length > 0) {
      return { errors };
    }
  }

  return { errors: [] };
};

export default function FreeShipping() {
  const { functionId, customization } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const isLoading = fetcher.state !== "idle";
  const isEnabled = !!customization?.enabled;
  const errors: { field: string; message: string }[] = fetcher.data?.errors ?? [];

  const toggle = () => {
    if (isEnabled && customization) {
      fetcher.submit(
        { intent: "disable", customizationId: customization.id },
        { method: "POST" },
      );
    } else if (functionId) {
      fetcher.submit(
        { intent: "enable", functionId },
        { method: "POST" },
      );
    }
  };

  if (!functionId) {
    return (
      <s-page heading="Kostenloser Versand EU">
        <s-section heading="Extension nicht gefunden">
          <s-paragraph>
            Die Extension wurde noch nicht deployed. Bitte zuerst{" "}
            <code>shopify app deploy</code> ausführen, damit die Funktion im
            Shop verfügbar ist.
          </s-paragraph>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Kostenloser Versand EU (Printful)">
      <s-section heading="Status">
        <s-paragraph>
          Versteckt kostenpflichtige Versandoptionen beim Checkout wenn alle
          Artikel von Printful kommen und das Lieferziel in der EU liegt —
          aber nur wenn eine kostenlose Option verfügbar ist.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-badge tone={isEnabled ? "success" : "critical"}>
            {isEnabled ? "Aktiv" : "Inaktiv"}
          </s-badge>
          <s-button
            onClick={toggle}
            {...(isLoading ? { loading: true } : {})}
            variant={isEnabled ? "secondary" : "primary"}
          >
            {isEnabled ? "Deaktivieren" : "Aktivieren"}
          </s-button>
        </s-stack>
        {errors.length > 0 && (
          <s-banner tone="critical">
            {errors.map((e) => (
              <s-paragraph key={e.field}>{e.message}</s-paragraph>
            ))}
          </s-banner>
        )}
      </s-section>
    </s-page>
  );
}

export type OrderWorkflowRecord = {
  source?: unknown;
  sourceChannel?: unknown;
  source_channel?: unknown;
  sourceLabel?: unknown;
  source_label?: unknown;
  platform?: unknown;
  platformType?: unknown;
  platform_type?: unknown;
  channel?: unknown;
  origin?: unknown;
  metadata?: unknown;
};

export type OrderWorkflowOwner = 'sedifexmarket' | 'store';

export type OrderWorkflowClassification = {
  owner: OrderWorkflowOwner;
  label: string;
  description: string;
  allowsAdminFulfillment: boolean;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Sedifex Admin owns fulfillment only when the order explicitly identifies
 * SedifexMarket as its source. Website, integration, and unknown orders remain
 * store-managed so Admin only audits payment receipt and store payout.
 */
export function classifyOrderWorkflow(order: OrderWorkflowRecord): OrderWorkflowClassification {
  const metadata = record(order.metadata);
  const sourceValues = [
    order.source,
    order.sourceChannel,
    order.source_channel,
    order.sourceLabel,
    order.source_label,
    order.platform,
    order.platformType,
    order.platform_type,
    order.channel,
    order.origin,
    metadata.source,
    metadata.sourceChannel,
    metadata.source_channel,
    metadata.platform,
    metadata.platformType,
    metadata.platform_type,
    metadata.channel,
    metadata.origin,
  ].map(text).filter(Boolean);

  const isSedifexMarket = sourceValues.some((value) => /(^|_)sedifex_?market($|_)/.test(value));

  if (isSedifexMarket) {
    return {
      owner: 'sedifexmarket',
      label: 'SedifexMarket managed',
      description: 'Sedifex Admin must verify payment and follow this order through product delivery or service completion.',
      allowsAdminFulfillment: true,
    };
  }

  return {
    owner: 'store',
    label: 'Store managed',
    description: 'Sedifex Admin confirms payment and records the store payout. Booking, follow-up, delivery, and completion are handled in the store UI.',
    allowsAdminFulfillment: false,
  };
}

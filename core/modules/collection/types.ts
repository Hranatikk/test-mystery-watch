export type ShippingAddress = {
  fullName: string;
  line1: string;
  city: string;
  postalCode: string;
  country: string;
};

export type ShipmentStatus = 'processing' | 'shipped' | 'delivered';

export type Shipment = {
  id: string;
  trackingCode: string;
  address: ShippingAddress;
  /** Current status, derived on the server from the elapsed time. */
  status: ShipmentStatus;
  /** Reached steps only, oldest first. */
  timeline: { status: ShipmentStatus; at: string }[];
};

export type OwnedWatch = {
  instanceId: string;
  watchId: string;
  /** Box it was pulled from; null for watches won in a trade-up. */
  boxId: string | null;
  origin: 'box' | 'tradeup';
  acquiredAt: string;
  /** false until the user has seen the reveal animation. */
  revealed: boolean;
  /** Present once the user asked for physical delivery. */
  shipment?: Shipment;
};

/** Only items sitting in the vault can be sold, traded or shipped. */
export function isInVault(item: OwnedWatch): boolean {
  return item.revealed && !item.shipment;
}

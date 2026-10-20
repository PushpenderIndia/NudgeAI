export interface ConnectorItem {
  id: string;
  [key: string]: unknown;
}

export interface ConnectorAction {
  type: string;
  payload: Record<string, unknown>;
}

export interface ActionResult {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Common interface for every integration. Mock and live implementations
 * both satisfy this, so the rest of the app never knows which is in use.
 */
export interface Connector {
  key: string;
  listItems(): Promise<ConnectorItem[]>;
  getItem(id: string): Promise<ConnectorItem | null>;
  performAction(action: ConnectorAction): Promise<ActionResult>;
}

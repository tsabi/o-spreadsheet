export interface NotificationUIEvent {
  type: "NOTIFICATION";
  text: string;
  notificationType: "INFORMATION";
  tag: string;
}

export interface ErrorUIEvent {
  type: "NOTIFICATION";
  text: string;
  notificationType: "ERROR";
}

export type NotifyUIEvent = NotificationUIEvent | ErrorUIEvent;

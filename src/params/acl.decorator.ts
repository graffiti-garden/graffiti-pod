import { headerArrayDecorator } from "./params.utils";

export const AccessControlList = headerArrayDecorator<undefined>(
  "access-control-list",
  undefined,
);

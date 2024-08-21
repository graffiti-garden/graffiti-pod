import { queryArrayDecorator } from "./params.utils";

export const AccessControlList = queryArrayDecorator<undefined>(
  "access-control-list",
  undefined,
);

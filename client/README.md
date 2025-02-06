# Graffiti Federated Implementation: Client

## TODO:

- Restore some of the federation details that got lost in the refactor.
  - Global settings:
    - Allow a user to publish a link to a GraffitiObject to their
      webId. Others can view this as their settings.
      Necessary for knowing whether a user has authorized a pod to
      publish content on their behalf and for setting up forwarding
      rules if a person moves pods.
  - Delegation:
    - Implents delegation on top of the global settings.
  - Announcements:
    - Announce the existince of a smaller pod on a larger pod.
      Replaces a seperate tracker service.
    - Pod announcements should also handle allowed lists
      (not leaking publication to a channel via the pod announcement)
      and should also handle deletions (if a user deletes something).
      Somethng along the lines of
      `updatePodAnnouncements(objectBefore: GraffitiObject|undefined, objectAfter: GraffitiObject|undefined): void`
  - Caching:
    - For streamables.

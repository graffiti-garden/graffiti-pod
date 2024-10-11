## TODO:

- documentation!!
- Refactor pod announcements into its own file.
  pod announcments should also handle access control lists
  (not leaking publication to a channel via the pod announcement)
  and should also handle deletions (if a user deletes something)
  Something along the lines of
    - `updatePodAnnouncements(objectBefore: GraffitiObject|undefined, objectAfter: GraffitiObject|undefined): void`
  During this refactor, perhaps there should be a seperate index.ts file
  specifically "raw" REST/discover operations that doesn't take into
  account pod announcements or delegation verification.
- less important:
  - more testing
  - local changes for listChannels / listOphans
  - persist the cache across reloads + cache purging

## TODO:

- webId currently just include a list of delegted pods, but should be update to include:
  - schemas for each delegated pod. For example, I may only
    want to post "hints" to major pods that point to my smaller pods.
  - forwarding rules that map objects from one pod to another.
    This is important for data portability, if a pod either goes
    down or becomes untrusted.
  - rules for which pod to post to when creating new objects.
    Each rule should have a specified schema. This will reduce
    the need for a "pod" field in the GraffitiSession type.
- documentation!!
- less important:
  - more testing
  - local changes for listChannels / listOphans
  - persist the cache across reloads + cache purging

## TODO:

- documentation!!
- schema for get to return a typed object
- webId currently just include a list of delegted pods, but should be update to include:
  - schemas for each delegated pod. For example, I may only
    want to post "hints" to major pods that point to my smaller pods.
  - forwarding rules that map objects from one pod to another.
    This is important for data portability, if a pod either goes
    down or becomes untrusted.
  - rules for which pod to post to when creating new objects.
    Each rule should have a specified schema. This will reduce
    the need for a "pod" field in the GraffitiSession type.
- when discovering in a channel, run another discover in that channel on
  objects of type { type: "PodHint", pod: "https://pod.example.com" }.
  Use the results to query for more related objects.
  - likewise, whenever a user posts, they should also post a hint
    to all pods that they know about.
- less important:
  - more testing
  - local changes for listChannels / listOphans
  - persist the cache across reloads + cache purging

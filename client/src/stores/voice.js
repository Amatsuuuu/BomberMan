import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useVoiceStore = defineStore('voice', () => {
  const enabled = ref(false);
  const muted = ref(false);
  const peers = ref(new Map());
  const localStream = ref(null);

  function setEnabled(val) { enabled.value = val; }
  function setMuted(val) { muted.value = val; }
  function setLocalStream(stream) { localStream.value = stream; }
  function addPeer(id, stream) { peers.value.set(id, stream); }
  function removePeer(id) { peers.value.delete(id); }
  function clearPeers() { peers.value = new Map(); }

  return { enabled, muted, localStream, peers, setEnabled, setMuted, setLocalStream, addPeer, removePeer, clearPeers };
});

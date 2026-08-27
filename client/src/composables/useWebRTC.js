import { ref } from 'vue';
import { useVoiceStore } from '../stores/voice.js';

const peerConnections = ref(new Map());

export function useWebRTC(socket) {
  const voiceStore = useVoiceStore();

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  async function startVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      voiceStore.setLocalStream(stream);
      voiceStore.setEnabled(true);
      voiceStore.setMuted(false);
      return stream;
    } catch (e) {
      console.warn('[Voice] Mic permission denied', e);
      voiceStore.setEnabled(false);
      return null;
    }
  }

  function stopVoice() {
    const local = voiceStore.localStream;
    if (local) {
      local.getTracks().forEach(t => t.stop());
    }
    for (const [id, pc] of peerConnections.value) {
      pc.close();
    }
    peerConnections.value.clear();
    voiceStore.clearPeers();
    voiceStore.setLocalStream(null);
    voiceStore.setEnabled(false);
  }

  function toggleMute() {
    const stream = voiceStore.localStream;
    if (!stream) return;
    const newMuted = !voiceStore.muted;
    stream.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    voiceStore.setMuted(newMuted);
  }

  function createPeerConnection(remoteId) {
    const localStream = voiceStore.localStream;
    if (!localStream || peerConnections.value.has(remoteId)) return null;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.value.set(remoteId, pc);

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      voiceStore.addPeer(remoteId, event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice-ice-candidate', { to: remoteId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pc.close();
        peerConnections.value.delete(remoteId);
        voiceStore.removePeer(remoteId);
      }
    };

    return pc;
  }

  async function initiateCall(remoteId) {
    const pc = createPeerConnection(remoteId);
    if (!pc) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('voice-offer', { to: remoteId, offer });
  }

  async function handleOffer(fromId, offer) {
    if (!voiceStore.enabled) return;

    let pc = peerConnections.value.get(fromId);
    if (!pc) {
      pc = createPeerConnection(fromId);
    }
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('voice-answer', { to: fromId, answer });
  }

  async function handleAnswer(fromId, answer) {
    const pc = peerConnections.value.get(fromId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function handleIceCandidate(fromId, candidate) {
    const pc = peerConnections.value.get(fromId);
    if (!pc) return;
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  function setupSignaling() {
    socket.on('voice-offer', ({ from, offer }) => handleOffer(from, offer));
    socket.on('voice-answer', ({ from, answer }) => handleAnswer(from, answer));
    socket.on('voice-ice-candidate', ({ from, candidate }) => handleIceCandidate(from, candidate));
  }

  return { startVoice, stopVoice, toggleMute, initiateCall, setupSignaling, peerConnections };
}

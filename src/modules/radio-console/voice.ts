let voiceEnabled = true;

export function setVoiceEnabled(enabled: boolean) {
  voiceEnabled = enabled;
}

export function isVoiceEnabled(): boolean {
  return voiceEnabled;
}

export function speakIndustrialAlert(text: string, priority: 'normal' | 'urgent' = 'normal') {
  if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  if (priority === 'urgent') {
    window.speechSynthesis.cancel(); // Interrompe frases anteriores se for alerta urgente
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = priority === 'urgent' ? 1.15 : 1.05;
  utterance.pitch = priority === 'urgent' ? 1.1 : 1.0;

  window.speechSynthesis.speak(utterance);
}

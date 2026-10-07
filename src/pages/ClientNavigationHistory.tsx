import { NavigationHistoryView } from "./AdminNavigationHistory";

export default function ClientNavigationHistory() {
  return (
    <NavigationHistoryView
      rpc="client_navigation_history"
      title="Navegações dos meus profissionais"
      privacyNote="Você vê as chegadas e as etapas dos profissionais dos seus serviços. O trajeto completo não é mostrado, por privacidade."
    />
  );
}

import AppointmentList from "@/components/scheduling/AppointmentList";
import { CalendarIcon } from "lucide-react";

interface Props {
  profileId: string;
  userType: "client" | "provider";
}

const AppointmentsSection = ({ profileId, userType }: Props) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display flex items-center gap-2">
          <CalendarIcon className="w-6 h-6 text-primary" />
          Agendamentos
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Gerencie seus compromissos</p>
      </div>
      <AppointmentList profileId={profileId} userType={userType} />
    </div>
  );
};

export default AppointmentsSection;

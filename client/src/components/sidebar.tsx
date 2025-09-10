import { useLanguage } from "@/hooks/use-language";
import { Microchip, Plus } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useLanguage();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed left-0 top-16 h-full w-64 bg-card border-r border-border shadow-lg transform transition-transform duration-300 z-40 ${
          isOpen ? 'sidebar-open' : 'sidebar-closed'
        }`}
        data-testid="sidebar"
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4" data-testid="text-sidebar-title">
            {t('sidebarTitle')}
          </h2>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-primary text-primary-foreground" data-testid="card-active-session">
              <div className="flex items-center space-x-2">
                <Microchip className="w-4 h-4" />
                <span className="font-medium">PLC-CONFIG-01</span>
              </div>
              <div className="text-sm opacity-90 mt-1">Active Session</div>
            </div>
            <div 
              className="p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
              data-testid="button-new-session"
            >
              <div className="flex items-center space-x-2">
                <Plus className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('newSessionText')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

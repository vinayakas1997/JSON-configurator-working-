import { useLanguage } from "@/hooks/use-language";
import { Microchip, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  plcName: string;
}

export function Sidebar({ isOpen, onClose, onToggle, plcName }: SidebarProps) {
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
        className={`fixed left-0 top-16 h-full w-64 bg-card border-r border-border shadow-lg transform transition-all duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="sidebar"
      >
        {/* Sidebar Toggle Button */}
        <div className="absolute -right-12 top-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onToggle}
            className="w-10 h-10 p-0 rounded-r-lg rounded-l-none border-l-0 shadow-md hover:shadow-lg transition-shadow"
            data-testid="button-sidebar-toggle"
          >
            {isOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground" data-testid="text-sidebar-title">
              {t('sidebarTitle')}
            </h2>
          </div>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-primary text-primary-foreground" data-testid="card-active-session">
              <div className="flex items-center space-x-2">
                <Microchip className="w-4 h-4" />
                <span className="font-medium">{plcName}</span>
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

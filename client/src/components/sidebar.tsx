import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { Microchip, Plus, ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PlcConfiguration } from "@shared/schema";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  plcName: string;
  onLoadSession?: (sessionId: string) => void;
  onNewSession?: () => void;
}

export function Sidebar({ isOpen, onClose, onToggle, plcName, onLoadSession, onNewSession }: SidebarProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all saved sessions
  const { data: sessions = [], isLoading } = useQuery<PlcConfiguration[]>({
    queryKey: ['/api/plc-configurations'],
    enabled: isOpen, // Only fetch when sidebar is open
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      console.log(`Attempting to delete session: ${sessionId}`);
      const response = await fetch(`/api/plc-configurations/${sessionId}`, {
        method: 'DELETE',
      });
      console.log(`Delete response status: ${response.status}`);
      if (!response.ok) {
        throw new Error(`Failed to delete session. Status: ${response.status}`);
      }
      return sessionId;
    },
    onSuccess: (sessionId) => {
      console.log(`Delete successful for session: ${sessionId}, invalidating queries`);
      queryClient.invalidateQueries({ queryKey: ['/api/plc-configurations'] });
    },
    onError: (error) => {
      console.error('Delete mutation error:', error);
    }
  });

  // Filter sessions based on search query
  const filteredSessions = sessions.filter((session: PlcConfiguration) =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (session.description && session.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDeleteSession = (sessionId: string, sessionName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the load session
    e.preventDefault();
    
    console.log(`Delete button clicked for session: ${sessionName} (${sessionId})`);
    
    const confirmed = window.confirm(`Are you sure you want to delete the session "${sessionName}"?`);
    console.log(`Confirmation result: ${confirmed}`);
    
    if (confirmed) {
      console.log(`Proceeding with deletion of session: ${sessionId}`);
      deleteMutation.mutate(sessionId);
    }
  };

  const handleLoadSession = (sessionId: string) => {
    onLoadSession?.(sessionId);
    onClose(); // Close sidebar after loading
  };

  const handleNewSession = () => {
    onNewSession?.();
    onClose(); // Close sidebar after creating new session
  };

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
          
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder={t('searchSessions')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-sm"
              data-testid="input-search-sessions"
            />
          </div>
          
          <div className="space-y-2">
            {/* Active Session */}
            <div className="p-3 rounded-lg bg-primary text-primary-foreground" data-testid="card-active-session">
              <div className="flex items-center space-x-2">
                <Microchip className="w-4 h-4" />
                <span className="font-medium">{plcName}</span>
              </div>
              <div className="text-sm opacity-90 mt-1">Active Session</div>
            </div>
            
            {/* New Session Button */}
            <div 
              className="p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
              onClick={handleNewSession}
              data-testid="button-new-session"
            >
              <div className="flex items-center space-x-2">
                <Plus className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('newSessionText')}</span>
              </div>
            </div>

            {/* Saved Sessions */}
            <div className="border-t border-border pt-2 mt-4">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Saved Sessions
              </div>
              
              {isLoading ? (
                <div className="p-3 text-center text-muted-foreground text-sm">
                  Loading sessions...
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="p-3 text-center text-muted-foreground text-sm">
                  {searchQuery ? 'No sessions match your search' : 'No saved sessions yet'}
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {filteredSessions.map((session: PlcConfiguration) => (
                    <div
                      key={session.id}
                      className="p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors group"
                      onClick={() => handleLoadSession(session.id)}
                      data-testid={`button-load-session-${session.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <Microchip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium text-sm truncate">{session.name}</span>
                          </div>
                          {session.description && (
                            <div className="text-xs text-muted-foreground mt-1 truncate">
                              {session.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {session.created_at ? new Date(session.created_at).toLocaleDateString() : 'No date'}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 flex-shrink-0 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDeleteSession(session.id, session.name, e)}
                          data-testid={`button-delete-session-${session.id}`}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

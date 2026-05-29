import { useState } from 'react';
import { Modal } from 'antd';
import { BranchIcon, ChevronRightIcon, TrashIcon } from './icons/ClaudeIcons';
import type { ChatSession } from '../types';
import '../styles/branch-tree.css';

interface BranchTreeProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectBranch: (id: string) => void;
  onCreateBranch: (parentId: string) => void;
  onDeleteBranch: (id: string) => void;
}

export default function BranchTree({ 
  sessions, 
  activeSessionId, 
  onSelectBranch, 
  onCreateBranch,
  onDeleteBranch 
}: BranchTreeProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);

  // Build tree structure (simplified - just shows recent branches)
  const getRecentBranches = (): ChatSession[] => {
    // Group sessions by title prefix to find branches
    const titleMap = new Map<string, ChatSession[]>();
    
    sessions.forEach(session => {
      // Extract base title (remove " (branch N)" suffix)
      const baseTitle = session.title.replace(/\s*\(branch\s*\d*\)/gi, '').trim();
      
      if (!titleMap.has(baseTitle)) {
        titleMap.set(baseTitle, []);
      }
      titleMap.get(baseTitle)!.push(session);
    });
    
    // Find titles with multiple sessions (branches)
    const branches: ChatSession[] = [];
    titleMap.forEach((sessions) => {
      if (sessions.length > 1) {
        branches.push(...sessions);
      }
    });
    
    return branches.sort((a, b) => b.updatedAt - a.updatedAt);
  };

  const branches = getRecentBranches();

  const handleBranch = () => {
    if (selectedSession) {
      onCreateBranch(selectedSession.id);
      setModalOpen(false);
      setSelectedSession(null);
    }
  };

  const handleDelete = () => {
    if (selectedSession) {
      onDeleteBranch(selectedSession.id);
      setModalOpen(false);
      setSelectedSession(null);
    }
  };

  return (
    <>
      <div className="branch-tree">
        <div className="branch-tree-header">
          <BranchIcon />
          <span>Conversation Branches</span>
          <span className="branch-count">{branches.length} branches</span>
        </div>

        <div className="branch-tree-content">
          {branches.length === 0 ? (
            <div className="branch-empty">
              <p>No branches yet</p>
              <span>Create a branch from the sidebar menu</span>
            </div>
          ) : (
            <div className="branch-list">
              {branches.map((session) => (
                <div 
                  key={session.id}
                  className={`branch-item ${session.id === activeSessionId ? 'active' : ''}`}
                >
                  <div 
                    className="branch-item-main"
                    onClick={() => onSelectBranch(session.id)}
                  >
                    <div className="branch-icon-wrapper">
                      <BranchIcon />
                    </div>
                    <div className="branch-info">
                      <div className="branch-title">
                        {session.title.replace(/\s*\(branch\s*\d*\)/gi, '')}
                        <span className="branch-suffix">
                          {session.title.match(/\(branch\s*\d*\)/)?.[0]}
                        </span>
                      </div>
                      <div className="branch-meta">
                        {session.messages.length} messages · {new Date(session.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <ChevronRightIcon className="branch-arrow" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title="Branch Options"
        footer={null}
        centered
      >
        {selectedSession && (
          <div className="branch-modal-content">
            <div className="branch-modal-info">
              <h4>{selectedSession.title}</h4>
              <p>{selectedSession.messages.length} messages</p>
            </div>
            
            <div className="branch-modal-actions">
              <button className="branch-action-btn primary" onClick={handleBranch}>
                <BranchIcon />
                <span>Create Branch</span>
              </button>
              <button className="branch-action-btn danger" onClick={handleDelete}>
                <TrashIcon />
                <span>Delete Branch</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
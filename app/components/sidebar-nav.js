'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDownIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  DocumentMagnifyingGlassIcon,
  DocumentPlusIcon,
  HomeIcon,
  PowerIcon,
  UserGroupIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';

export default function SidebarNav({ role, isAdmin, onLogout, user, isExpanded, onToggleExpand }) {
  const pathname = usePathname();
  const [isTransmittalMenuOpen, setIsTransmittalMenuOpen] = useState(false);
  const canAccessTransmittals = role !== 'viewer';
  const canAccessPosting = role === 'viewer' || canAccessTransmittals;
  const isHome = pathname === '/dashboard';
  const isDocuments = pathname === '/dashboard/documents';
  const isEcopyMonitor = pathname === '/dashboard/ecopy-monitor';
  const isProfile = pathname === '/dashboard/profile';
  const isAddECopy = pathname === '/dashboard/transmittals/new';
  const isPosting = pathname === '/dashboard/transmittals/posting';
  const isAutoLetter = pathname === '/dashboard/transmittals/auto-letter';
  const isTransmittal = isAddECopy || isAutoLetter || (pathname.startsWith('/dashboard/transmittals/') && !isPosting);
  const isUsers = pathname === '/dashboard/admin/users/new';
  const userInitial = user?.username ? String(user.username).charAt(0).toUpperCase() : 'U';

  return (
    <aside className={`sidebar-nav${isExpanded ? ' expanded' : ''}`} aria-label={`Main navigation (${role})`}>
      <div className="sidebar-brand-row">
        <Link href="/dashboard" className="sidebar-brand-orb" title={`Role: ${role}`} aria-label="Go to Dashboard">
          <Image
            src="/sb.png"
            width={1000}
            height={760}
            className="sidebar-brand-logo"
            alt="Sangguniang Bayan Taytay, Palawan"
          />
        </Link>
        <span className="sidebar-brand-text">
          <span>Sangguniang Bayan</span>
          <span>Record Office</span>
        </span>
        
      </div>

      <div className="sidebar-links">
        <button
          type="button"
          className="sidebar-icon-btn sidebar-expand-btn"
          onClick={onToggleExpand}
          aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          <span className="sidebar-expand-icon">{isExpanded ? '«' : '»'}</span>
          <span className="sidebar-label">Menu</span>
        </button>

        <Link
          href="/dashboard"
          className={`sidebar-icon-link${isHome ? ' active' : ''}`}
          title="Home"
          aria-label="Home"
        >
          <HomeIcon className="sidebar-ico-svg" aria-hidden="true" />
          <span className="sidebar-label">Home</span>
        </Link>

        <Link
          href="/dashboard/documents"
          className={`sidebar-icon-link${isDocuments ? ' active' : ''}`}
          title="Document List"
          aria-label="Document List"
        >
          <ClipboardDocumentListIcon className="sidebar-ico-svg" aria-hidden="true" />
          <span className="sidebar-label">Document List</span>
        </Link>

        {role !== 'viewer' ? (
          <Link
            href="/dashboard/ecopy-monitor"
            className={`sidebar-icon-link${isEcopyMonitor ? ' active' : ''}`}
            title="E-copy Monitor"
            aria-label="E-copy Monitor"
          >
            <DocumentMagnifyingGlassIcon className="sidebar-ico-svg" aria-hidden="true" />
            <span className="sidebar-label">E-copy Monitoring</span>
          </Link>
        ) : null}

        {canAccessTransmittals ? (
          <div className={`sidebar-transmittal-wrap${isTransmittalMenuOpen ? ' open' : ''}`}>
            <button
              type="button"
              className={`sidebar-icon-btn sidebar-transmittal-btn${isTransmittal ? ' active' : ''}`}
              title="Transmittals"
              aria-label="Transmittals menu"
              aria-expanded={isTransmittalMenuOpen}
              aria-controls="sidebar-transmittal-menu"
              onClick={() => setIsTransmittalMenuOpen((v) => !v)}
            >
              <ClipboardDocumentIcon className="sidebar-ico-svg" aria-hidden="true" />
              <ChevronDownIcon className={`sidebar-transmittal-chevron${isTransmittalMenuOpen ? ' open' : ''}`} aria-hidden="true" />
              <span className="sidebar-label">Transmittals</span>
            </button>
            <div id="sidebar-transmittal-menu" className={`sidebar-transmittal-menu${isTransmittalMenuOpen ? ' open' : ''}`}>
              <Link
                href="/dashboard/transmittals/new"
                className={`sidebar-transmittal-link${isAddECopy ? ' active' : ''}`}
                title="Add E-copy"
                aria-label="Add E-copy"
                onClick={() => setIsTransmittalMenuOpen(false)}
              >
                <DocumentPlusIcon className="sidebar-ico-svg" aria-hidden="true" />
                <span>Add E-copy</span>
              </Link>
              <Link
                href="/dashboard/transmittals/auto-letter"
                className={`sidebar-transmittal-link${isAutoLetter ? ' active' : ''}`}
                title="Auto letter"
                aria-label="Auto letter"
                onClick={() => setIsTransmittalMenuOpen(false)}
              >
                <PencilSquareIcon className="sidebar-ico-svg" aria-hidden="true" />
                <span>Generate letter</span>
              </Link>
            </div>
            </div>
          ) : null}

        {canAccessPosting ? (
          <Link
            href="/dashboard/transmittals/posting"
            className={`sidebar-icon-link${isPosting ? ' active' : ''}`}
            title="Posting"
            aria-label="Posting"
          >
            <ClipboardDocumentCheckIcon className="sidebar-ico-svg" aria-hidden="true" />
            <span className="sidebar-label">Posting</span>
          </Link>
        ) : null}

        {isAdmin ? (
          <Link
            href="/dashboard/admin/users/new"
            className={`sidebar-icon-link${isUsers ? ' active' : ''}`}
            title="Users"
            aria-label="Users"
          >
            <UserGroupIcon className="sidebar-ico-svg" aria-hidden="true" />
            <span className="sidebar-label">Users</span>
          </Link>
        ) : null}
      </div>

      <div className="sidebar-bottom">
        <Link
          href="/dashboard/profile"
          className={`sidebar-user-chip${isProfile ? ' active' : ''}`}
          title={user?.username || 'User'}
          aria-label="User Profile"
        >
          {userInitial}
          <span className="sidebar-label">Profile</span>
        </Link>
        <button className="sidebar-icon-btn danger" type="button" onClick={onLogout} title="Logout" aria-label="Logout">
          <PowerIcon className="sidebar-ico-svg" aria-hidden="true" />
          <span className="sidebar-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}

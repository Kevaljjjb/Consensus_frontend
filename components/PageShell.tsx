'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

interface PageShellProps {
    children: React.ReactNode;
    activePage: 'dashboard' | 'deals' | 'contacts' | 'settings' | 'profile';
}

export default function PageShell({ children, activePage }: PageShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // We need to pass the toggle state back if we want the main content to animate alongside the sidebar
    // For simplicity and since we want the EXACT same behavior, we'll keep the sidebar internal logic 
    // but we can lift the state here.

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 flex overflow-hidden">
            <SidebarWrapper isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} activePage={activePage} />

            <motion.main
                initial={false}
                animate={{ marginLeft: isSidebarOpen ? 240 + 48 : 72 + 48 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex-1 p-8 max-w-7xl"
            >
                {children}
            </motion.main>
        </div>
    );
}

// Internal wrapper to handle the sidebar with externalized state
import {
    LayoutGrid,
    Briefcase,
    Users,
    Settings,
    User,
    Menu
} from 'lucide-react';
import Link from 'next/link';

function NavItem({ icon, label, isOpen, active, href }: { icon: React.ReactNode, label: string, isOpen: boolean, active?: boolean, href: string }) {
    return (
        <Link href={href}>
            <div className={`flex items-center rounded-2xl cursor-pointer transition-all duration-200 ${isOpen ? 'mx-3 px-3 py-2.5' : 'mx-auto px-0 py-2.5 w-10 justify-center'} ${active ? 'bg-[#F6DF5F]/20 text-[#F6DF5F]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6">
                    {icon}
                </div>
                <motion.div
                    initial={false}
                    animate={{
                        width: isOpen ? "auto" : 0,
                        opacity: isOpen ? 1 : 0,
                        marginLeft: isOpen ? 12 : 0
                    }}
                    className="overflow-hidden whitespace-nowrap font-medium text-sm"
                >
                    {label}
                </motion.div>
            </div>
        </Link>
    );
}

function SidebarWrapper({ isOpen, setIsOpen, activePage }: { isOpen: boolean, setIsOpen: (o: boolean) => void, activePage: string }) {
    return (
        <motion.div
            initial={false}
            animate={{ width: isOpen ? 240 : 72 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-20"
        >
            <div className="bg-[#414854] rounded-[28px] flex flex-col shadow-xl shadow-slate-900/10 overflow-hidden">
                <div className="h-[56px] flex items-center text-[#F6DF5F] relative border-b border-white/10">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="absolute left-0 w-[72px] h-[56px] flex items-center justify-center z-10 hover:bg-white/5 transition-colors"
                    >
                        <Menu size={22} />
                    </button>
                    <motion.div
                        initial={false}
                        animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : -20 }}
                        className="font-bold text-base ml-[72px] whitespace-nowrap"
                    >
                        Consensus
                    </motion.div>
                </div>

                <div className="flex flex-col py-3 gap-1">
                    <NavItem icon={<LayoutGrid size={20} />} label="Dashboard" isOpen={isOpen} active={activePage === 'dashboard'} href="/" />
                    <NavItem icon={<Briefcase size={20} />} label="Deals" isOpen={isOpen} active={activePage === 'deals'} href="/deal" />
                    <NavItem icon={<Users size={20} />} label="Contacts" isOpen={isOpen} active={activePage === 'contacts'} href="#" />
                    <NavItem icon={<Settings size={20} />} label="Settings" isOpen={isOpen} active={activePage === 'settings'} href="#" />
                </div>

                <div className="border-t border-white/10 py-3">
                    <NavItem icon={<User size={20} />} label="Profile" isOpen={isOpen} active={activePage === 'profile'} href="#" />
                </div>
            </div>
        </motion.div>
    );
}

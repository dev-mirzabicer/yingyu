"use client"

import type React from "react"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  BookOpen,
  Brain,
  Calendar,
  DollarSign,
  Settings,
  BarChart3,
  Globe,
  Layers,
  Monitor,
  User,
  LogOut,
  ChevronUp,
  Bell,
  HelpCircle,
} from "lucide-react"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> { }

const navigationItems = [
  {
    title: "Dashboard",
    items: [
      {
        title: "Overview",
        url: "/",
        icon: BarChart3,
        badge: null,
      },
      {
        title: "Students",
        url: "/students",
        icon: Users,
        badge: null,
      },
    ],
  },
  {
    title: "Content Management",
    items: [
      {
        title: "Vocabulary Decks",
        url: "/decks",
        icon: BookOpen,
        badge: null,
      },
      {
        title: "Units",
        url: "/units",
        icon: Layers,
        badge: null,
      },
      {
        title: "Public Library",
        url: "/library",
        icon: Globe,
        badge: "New",
      },
    ],
  },
  {
    title: "Teaching Tools",
    items: [
      {
        title: "Live Sessions",
        url: "/sessions",
        icon: Monitor,
        badge: null,
      },
      {
        title: "FSRS Analytics",
        url: "/analytics",
        icon: Brain,
        badge: null,
      },
      {
        title: "Scheduling",
        url: "/schedule",
        icon: Calendar,
        badge: null,
      },
      {
        title: "Payments",
        url: "/payments",
        icon: DollarSign,
        badge: null,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Settings",
        url: "/settings",
        icon: Settings,
        badge: null,
      },
    ],
  },
]

// Mock user data - in production this would come from auth context
const mockUser = {
  name: "Li Jingya",
  email: "lijingya@example.com",
  avatar: "/placeholder.svg?height=40&width=40",
  role: "Teacher",
}

export function AppSidebar({ ...props }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center space-x-3 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">Y</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">Yingyu English</h2>
            <p className="text-sm text-slate-500 truncate">Teaching Platform</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigationItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.url
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.url} className="flex items-center space-x-3">
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.title}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={mockUser.avatar || "/placeholder.svg"} alt={mockUser.name} />
                      <AvatarFallback>{mockUser.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-slate-900 truncate">{mockUser.name}</div>
                      <div className="text-xs text-slate-500 truncate">{mockUser.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <ChevronUp className="h-4 w-4" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <div className="p-2">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={mockUser.avatar || "/placeholder.svg"} alt={mockUser.name} />
                      <AvatarFallback>{mockUser.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{mockUser.name}</div>
                      <div className="text-xs text-slate-500 truncate">{mockUser.email}</div>
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Help & Support</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

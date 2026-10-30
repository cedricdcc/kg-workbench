"use client"

import React from "react"
import { Cpu } from "lucide-react"
import type { SystemServiceDisplay } from "@/features/settings/server/queries/get-system-services"
import { ServiceCard } from "./service-card"

interface ServicesSectionProps {
  services: SystemServiceDisplay[]
}

export function ServicesSection({ services }: ServicesSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">
            Microservice Mesh & Sidecars
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Modular services coordinated via the event mesh. Enable sidecar
          profiles in Docker Compose as your workload scales.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </div>
  )
}

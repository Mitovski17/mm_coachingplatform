'use client'

import Link from 'next/link'
import { Dumbbell, Utensils, ExternalLink } from 'lucide-react'
import type { ClientAssignments } from '../actions'

type Props = {
  assignments: ClientAssignments
  clientId: string
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div
      style={{
        border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: 'var(--color-text-hint)',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 13 }}>{label}</span>
    </div>
  )
}

type AssignmentCardProps = {
  icon: React.ReactNode
  label: string
  name: string
  href: string
  accentColor: string
  meta?: string
}

function AssignmentCard({ icon, label, name, href, accentColor, meta }: AssignmentCardProps) {
  return (
    <Link
      href={href}
      style={{ textDecoration: 'none' }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          cursor: 'pointer',
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = accentColor
          el.style.backgroundColor = 'var(--color-surface-2)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'var(--color-border)'
          el.style.backgroundColor = 'var(--color-surface-1)'
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: `${accentColor}1a`,
            border: `1px solid ${accentColor}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: accentColor,
          }}
        >
          {icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: meta ? 4 : 0 }}>
            {name}
          </div>
          {meta && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {meta}
            </div>
          )}
        </div>

        {/* Arrow */}
        <div style={{ flexShrink: 0, color: 'var(--color-text-hint)', display: 'flex', alignItems: 'center' }}>
          <ExternalLink size={14} />
        </div>
      </div>
    </Link>
  )
}

export default function AssignmentsTab({ assignments, clientId }: Props) {
  const { workoutProgram, trainingMealPlan, restMealPlan, overallMealPlan } = assignments
  const hasAny = workoutProgram || trainingMealPlan || restMealPlan || overallMealPlan

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          Assignments
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: 0 }}>
          Active programs and meal plans assigned to this client. Click any card to open the full plan.
        </p>
      </div>

      {/* Training section */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-hint)', marginBottom: 10 }}>
          Training
        </div>
        {workoutProgram ? (
          <AssignmentCard
            icon={<Dumbbell size={18} />}
            label="Workout Program"
            name={workoutProgram.name}
            href={`/coach/programs/${workoutProgram.id}`}
            accentColor="#3b82f6"
            meta="Active program"
          />
        ) : (
          <EmptySlot label="No workout program assigned" />
        )}
      </div>

      {/* Nutrition section */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-hint)', marginBottom: 10 }}>
          Nutrition
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {trainingMealPlan ? (
            <AssignmentCard
              icon={<Utensils size={18} />}
              label="Training Day Meal Plan"
              name={trainingMealPlan.name}
              href={`/coach/meal-plans/templates/${trainingMealPlan.id}`}
              accentColor="#f97316"
              meta="Training days"
            />
          ) : (
            <EmptySlot label="No training day meal plan assigned" />
          )}
          {overallMealPlan ? (
            <AssignmentCard
              icon={<Utensils size={18} />}
              label="Overall Meal Plan"
              name={overallMealPlan.name}
              href={`/coach/meal-plans/templates/${overallMealPlan.id}`}
              accentColor="#22c55e"
              meta="All days"
            />
          ) : (
            <EmptySlot label="No overall meal plan assigned" />
          )}
          {restMealPlan ? (
            <AssignmentCard
              icon={<Utensils size={18} />}
              label="Rest Day Meal Plan"
              name={restMealPlan.name}
              href={`/coach/meal-plans/templates/${restMealPlan.id}`}
              accentColor="#a855f7"
              meta="Rest days"
            />
          ) : (
            <EmptySlot label="No rest day meal plan assigned" />
          )}
        </div>
      </div>

      {/* Empty state */}
      {!hasAny && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: 'var(--color-text-hint)',
            fontSize: 14,
          }}
        >
          No assignments yet. Go to the client&apos;s meal plan or program settings to assign one.
        </div>
      )}

      {/* Quick links */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link
          href={`/coach/meal-plans/assignments/${clientId}`}
          style={{
            fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <Utensils size={11} />
          Manage meal plan assignments
        </Link>
        <Link
          href="/coach/programs"
          style={{
            fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <Dumbbell size={11} />
          Browse programs
        </Link>
      </div>
    </div>
  )
}

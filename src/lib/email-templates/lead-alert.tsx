import * as React from 'react'
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  heading: string
  intro?: string
  name?: string
  details?: string[]
  link?: string
  cta?: string
}

const Email = ({ heading, intro, name, details, link, cta }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{heading}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{heading}</Heading>
        {intro ? <Text style={text}>{intro}</Text> : null}
        {name || (details && details.length) ? (
          <Section style={box}>
            {name ? <Text style={value}>{name}</Text> : null}
            {(details ?? []).map((d, i) => (
              <Text key={i} style={detail}>{d}</Text>
            ))}
          </Section>
        ) : null}
        {link ? (
          <Text style={text}>
            <Link href={link} style={linkStyle}>{cta ?? 'Öppna i CRM:et'}</Link>
          </Text>
        ) : null}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => String(data?.heading ?? 'Ny händelse i CRM:et'),
  displayName: 'Lead-notis',
  previewData: {
    heading: 'Ny lead: Anna Svensson',
    intro: 'En ny förfrågan har kommit in.',
    name: 'Anna Svensson',
    details: ['Källa: Hemsidan', 'Tel: 070-123 45 67'],
    link: 'https://admin-vt6.tejnevidar.workers.dev/leads',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '22px', margin: '0 0 12px' }
const box = { border: '1px solid #e5e5e5', borderRadius: '6px', padding: '12px 16px', margin: '14px 0' }
const value = { fontSize: '16px', color: '#000', margin: '0 0 6px', fontWeight: 600 as const }
const detail = { fontSize: '14px', color: '#333', margin: '0 0 4px', whiteSpace: 'pre-wrap' as const }
const linkStyle = { color: '#0b6bcb', fontWeight: 600 as const }

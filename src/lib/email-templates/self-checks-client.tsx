import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface SelfChecksClientProps {
  greetName?: string
  address: string
  links: { label: string; url: string }[]
}

const Email = ({ greetName, address, links }: SelfChecksClientProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Egenkontroller för {address}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Egenkontroller</Heading>
        <Text style={text}>
          Hej{greetName ? ` ${greetName}` : ''}!
        </Text>
        <Text style={text}>
          Vi tackar för förtroendet för projektet på "{address}" och översänder här
          alla egenkontroller och dokumentation.
        </Text>
        <Text style={text}>
          Vänligen kontakta eran kontaktperson för projektet om det uppstår
          frågetecken som rör egenkontrollerna.
        </Text>
        <Section style={listBox}>
          <Text style={listHeading}>Dokument</Text>
          {links.map((l, i) => (
            <Text key={i} style={listItem}>
              <Link href={l.url} style={link}>{l.label}</Link>
            </Text>
          ))}
          <Text style={footerNote}>
            Länkarna är giltiga i 30 dagar.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Egenkontroller – ${data?.address ?? 'projekt'}`,
  displayName: 'Egenkontroller till beställare',
  previewData: {
    greetName: 'Anna',
    address: 'Storgatan 1, Stockholm',
    links: [
      { label: 'Egenkontroll 1 – Takarbete', url: 'https://example.com/1.pdf' },
      { label: 'Egenkontroll 2 – Plåtarbete', url: 'https://example.com/2.pdf' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 15px',
}
const listBox = {
  marginTop: '20px',
  padding: '16px 18px',
  backgroundColor: '#f6f7f9',
  borderRadius: '8px',
}
const listHeading = {
  fontSize: '13px',
  fontWeight: 'bold' as const,
  color: '#0f172a',
  margin: '0 0 10px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
}
const listItem = {
  fontSize: '14px',
  color: '#0f172a',
  margin: '0 0 8px',
}
const link = { color: '#0b5fff', textDecoration: 'underline' }
const footerNote = {
  fontSize: '12px',
  color: '#999999',
  margin: '12px 0 0',
}

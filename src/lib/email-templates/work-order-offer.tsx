import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  address?: string
  price?: string
  deadline?: string
  url?: string
  contact?: string
}

// Mot underentreprenörer används företagsnamnet VT6 Invest (inte varumärket RoslagsTak).
const Email = ({ address, price, deadline, url, contact }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{`Nytt uppdrag / New assignment: ${address ?? ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nytt uppdrag från VT6 Invest</Heading>
        <Text style={text}>
          Vi har ett nytt takarbete åt dig. Öppna arbetsordern, se omfattning och fast pris, och acceptera eller
          avböj digitalt.
        </Text>
        <Section style={box}>
          <Text style={label}>Adress</Text>
          <Text style={value}>{address}</Text>
          <Text style={label}>Fast pris (exkl. moms)</Text>
          <Text style={value}>{price}</Text>
          <Text style={label}>Svara senast</Text>
          <Text style={value}>{deadline}</Text>
          {contact ? (
            <>
              <Text style={label}>Kontaktperson</Text>
              <Text style={value}>{contact}</Text>
            </>
          ) : null}
        </Section>
        <Section style={{ margin: '20px 0' }}>
          <Button href={url ?? '#'} style={button}>
            Öppna arbetsordern / Open the work order
          </Button>
        </Section>
        <Heading as="h2" style={h2}>New assignment from VT6 Invest</Heading>
        <Text style={text}>
          We have a new roofing job for you. Open the work order to see the scope and the fixed price, and accept or
          decline online. Please reply by the time stated above; otherwise the job is offered to the next contractor.
        </Text>
        <Text style={small}>Link: {url}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => `Nytt uppdrag / New assignment – ${data?.address ?? ''}`.trim(),
  displayName: 'Arbetsorder till UE',
  previewData: {
    address: 'Storgatan 1, Täby',
    price: '85 000 kr',
    deadline: '2026-09-28 10:00',
    url: 'https://admin-vt6.tejnevidar.workers.dev/arbetsorder/abc',
    contact: 'Herman Barth, 070-000 00 00',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 16px' }
const h2 = { fontSize: '16px', fontWeight: 'bold' as const, color: '#000000', margin: '24px 0 8px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '22px', margin: '0 0 12px' }
const box = { border: '1px solid #e5e5e5', borderRadius: '6px', padding: '12px 16px', margin: '14px 0' }
const label = { fontSize: '12px', color: '#777', margin: '8px 0 0' }
const value = { fontSize: '15px', color: '#000', margin: '0 0 4px', fontWeight: 600 as const }
const button = {
  backgroundColor: '#0b6bcb',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 600 as const,
  textDecoration: 'none',
}
const small = { fontSize: '12px', color: '#666', margin: '8px 0 0', wordBreak: 'break-all' as const }

import { Html, Head, Body, Container, Heading, Text, Button, Preview } from "@react-email/components"

interface Props {
  consultationTitle: string
  oldStatus: string
  newStatus: string
  consultationUrl: string
}

export function ConsultationStatusChangedEmail({ consultationTitle, oldStatus, newStatus, consultationUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{consultationTitle} status changed to {newStatus}</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Consultation status updated</Heading>
          <Text>
            <strong>{consultationTitle}</strong> moved from <strong>{oldStatus}</strong> to <strong>{newStatus}</strong>.
          </Text>
          <Button href={consultationUrl}>View consultation</Button>
        </Container>
      </Body>
    </Html>
  )
}

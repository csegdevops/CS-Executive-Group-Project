import { Html, Head, Body, Container, Heading, Text, Button, Preview } from "@react-email/components"

interface Props {
  consultationTitle: string
  dueDate: string
  consultationUrl: string
}

export function DueDateReminderEmail({ consultationTitle, dueDate, consultationUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{consultationTitle} is due {dueDate}</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Consultation due date approaching</Heading>
          <Text>
            <strong>{consultationTitle}</strong> is due on <strong>{dueDate}</strong>.
          </Text>
          <Button href={consultationUrl}>View consultation</Button>
        </Container>
      </Body>
    </Html>
  )
}

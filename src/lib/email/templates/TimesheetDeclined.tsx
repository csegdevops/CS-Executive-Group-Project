import { Html, Head, Body, Container, Heading, Text, Button, Preview } from "@react-email/components"

interface Props {
  weekStarting: string
  reason: string
  timesheetUrl: string
}

export function TimesheetDeclinedEmail({ weekStarting, reason, timesheetUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your timesheet for {weekStarting} was declined</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Timesheet declined</Heading>
          <Text>
            Your timesheet for the week of <strong>{weekStarting}</strong> was declined:
          </Text>
          <Text style={{ padding: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px" }}>
            {reason}
          </Text>
          <Text>Amend the entries and resubmit when you&apos;re ready.</Text>
          <Button href={timesheetUrl}>Amend timesheet</Button>
        </Container>
      </Body>
    </Html>
  )
}

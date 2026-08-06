import { Html, Head, Body, Container, Heading, Text, Button, Preview } from "@react-email/components"

interface Props {
  weekStarting: string
  timesheetUrl: string
}

export function TimesheetApprovedEmail({ weekStarting, timesheetUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your timesheet for {weekStarting} was approved</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Timesheet approved</Heading>
          <Text>
            Your timesheet for the week of <strong>{weekStarting}</strong> has been approved.
          </Text>
          <Button href={timesheetUrl}>View timesheet</Button>
        </Container>
      </Body>
    </Html>
  )
}

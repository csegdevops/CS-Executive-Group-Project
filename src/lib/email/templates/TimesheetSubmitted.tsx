import { Html, Head, Body, Container, Heading, Text, Button, Preview } from "@react-email/components"

interface Props {
  contractorName: string
  weekStarting: string
  approvalUrl: string
}

export function TimesheetSubmittedEmail({ contractorName, weekStarting, approvalUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{contractorName} submitted a timesheet for your approval</Preview>
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Timesheet submitted</Heading>
          <Text>
            <strong>{contractorName}</strong> submitted their timesheet for the week of <strong>{weekStarting}</strong> and it&apos;s waiting on your approval.
          </Text>
          <Button href={approvalUrl}>Review timesheet</Button>
        </Container>
      </Body>
    </Html>
  )
}

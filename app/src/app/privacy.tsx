import { InfoPage } from '@/components/info-page';

export default function PrivacyScreen() {
  return (
    <InfoPage
      title="Privacy"
      intro="What we collect when you order from RKR Crackers, and what we do with it."
      sections={[
        {
          heading: 'What we collect',
          body: [
            'Your email address, used to log you in with a one-time code.',
            'Your name, mobile number and delivery address, and the items in each estimate you send.',
          ],
        },
        {
          heading: 'How we use it',
          body: [
            'Only to process your orders: to call you to confirm, to send your parcel, and to show you your past orders.',
            'We do not sell or rent your details, and we do not send you advertising emails.',
          ],
        },
        {
          heading: 'Who sees it',
          body: [
            'Our staff, to handle your order, and the transport service, which receives your name, phone number and address on the parcel.',
            'Login code emails are sent through an email delivery provider. We may also disclose details where the law requires it.',
          ],
        },
        {
          heading: 'On your device',
          body: [
            'The app stores your cart and your login session on your phone or browser so you stay logged in. Logging out removes the session.',
          ],
        },
        {
          heading: 'Your choices',
          body: [
            'To see, correct or delete your details and order history, call or WhatsApp us on the numbers on the price list. We keep order records only as long as tax and accounting rules require.',
          ],
        },
      ]}
    />
  );
}

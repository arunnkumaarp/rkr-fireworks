import { InfoPage } from '@/components/info-page';

export default function TermsScreen() {
  return (
    <InfoPage
      title="Terms of sale"
      intro="How ordering from RKR Crackers works. By sending an estimate you agree to these terms."
      sections={[
        {
          heading: 'Estimates, not online payments',
          body: [
            'Submitting your list on this website or app sends us an estimate. It is not a confirmed order and no payment is taken online.',
            'We call you on the number you give to confirm the items, quantities, price and delivery. The order is confirmed only after that call and your payment.',
          ],
        },
        {
          heading: 'Prices and stock',
          body: [
            'Prices are the MRP on our 2026 price list with the discount shown. We may correct prices or remove items that are out of stock; we tell you on the confirmation call before you pay.',
            'Orders must meet the minimum order value shown at checkout.',
          ],
        },
        {
          heading: 'Payment',
          body: [
            'Pay only after we confirm your order by phone, using the UPI ID, QR code or bank details we share. Send us the payment screenshot on WhatsApp.',
          ],
        },
        {
          heading: 'Delivery',
          body: [
            'We send orders through lorry transport services to the transport office nearest you. Transport charges are paid by you at delivery.',
            'Firecrackers are delivered only to places where their sale and transport are allowed. We may decline orders for restricted areas.',
            'Check your parcel at the transport office. Report any shortage or damage to us within 24 hours with photos.',
          ],
        },
        {
          heading: 'Cancellations and returns',
          body: [
            'You can cancel before payment at no cost. Once goods are dispatched they cannot be returned, because firecrackers are hazardous goods.',
          ],
        },
        {
          heading: 'Who can buy',
          body: [
            'You must be 18 or older to order. Use the products as directed on the box and in our safety guide; RKR Crackers is not responsible for misuse.',
          ],
        },
      ]}
    />
  );
}

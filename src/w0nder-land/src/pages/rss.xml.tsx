import { GetServerSidePropsContext } from 'next';
import Rss from 'rss';
import { getTexts } from '@/components/editor/utils';
import { postReader } from '@/server/post-reader';
import { Configure } from '@/constants/configure';

const RssXmlPage = () => null;

export default RssXmlPage;

export const getServerSideProps = async ({ res }: GetServerSidePropsContext) => {
  const rss = new Rss({
    title: 'w0nder.land',
    feed_url: `${Configure.ServiceUrl}/rss.xml`,
    site_url: `${Configure.ServiceUrl}`,
    image_url: `${Configure.ServiceUrl}/favicon/android-chrome-512x512.png`,
    copyright: '2024, w0nder',
    pubDate: new Date(),
    ttl: 60, // 1 hour
  });

  (await postReader().listPublished()).forEach(post =>
    rss.item({
      title: post.title,
      description: getTexts(post.article),
      url: `${Configure.ServiceUrl}${post.url}`,
      guid: post.uuid,
      date: post.createdAt,
      author: post.author,
    }),
  );

  res.setHeader('Content-Type', 'text/xml');
  res.write(rss.xml());
  res.end();

  return { props: {} };
};

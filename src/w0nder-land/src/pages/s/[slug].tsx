import { GetServerSidePropsContext } from 'next';
import { postReader } from '@/server/post-reader';
import { resolveShortCode } from '@/libs/routing/post-routes';

const ShortUrlPage = () => <div />;

export const getServerSideProps = async ({ query }: GetServerSidePropsContext) => {
  const slug = String(query.slug);
  const posts = await postReader().listPublished();
  const post = resolveShortCode(slug, posts);

  if (!post) {
    return {
      redirect: {
        destination: '/posts',
        permanent: false,
      },
      props: {},
    };
  }

  return {
    redirect: {
      destination: post.url,
      permanent: false,
    },
    props: {},
  };
};

export default ShortUrlPage;

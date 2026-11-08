import { postReader } from '@/server/post-reader';
import { latestPost } from '@/libs/routing/post-routes';

const LatestPage = () => <div />;

export const getServerSideProps = async () => {
  const posts = await postReader().listPublished();
  const post = latestPost(posts);

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

export default LatestPage;

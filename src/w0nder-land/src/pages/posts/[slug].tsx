import { HeadContentMeta } from '@/components/common/HeadContentMeta';
import { Share } from '@/components/common/Share';
import { BlogPostDetail } from '@/components/ui/BlogPostDetail';
import { BrutalButton } from '@/components/ui/BrutalButton';
import { getTexts } from '@/components/editor/utils';
import { Configure } from '@/constants/configure';
import { ellipsis } from '@/libs/utils/string';
import { getPostRouteParam, getPostUrl, isPostSlugOf } from '@/libs/utils/urls';
import type { Post } from '@/repository/post-types';
import { postReader } from '@/server/post-reader';
import { DateTime } from 'luxon';
import { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import type { BlogPosting, WithContext } from 'schema-dts';
import { getCategoryColor, getCategoryName } from '@/libs/utils/category';

function getReadTime(content: string) {
  const charsPerMinute = 400; // 한글 기준 1분에 400자
  const { length } = content.replace(/\s/g, ''); // 공백 제외 글자수
  const minutes = Math.max(1, Math.ceil(length / charsPerMinute));
  return `${minutes}분`;
}

type PostProps = {
  post: Post;
};

const PostPage = ({ post }: PostProps) => {
  const router = useRouter();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const postCreatedAt = useMemo(() => post && DateTime.fromISO(post.createdAt), [post]);

  useEffect(() => {
    if (!router.isReady || !post) {
      return;
    }
    const slug = typeof router.query.slug === 'string' ? router.query.slug : '';
    const canonicalPath = getPostUrl(post.uuid, post.title);
    if (slug === post.uuid) {
      router.replace(canonicalPath);
    }
  }, [router, router.isReady, router.query.slug, post]);

  // 80자 이상이 되면 검색엔진에서 잘 처리해주지 못한다 80자 이상이면 ellipsis 처리를 해준다.
  const title = useMemo(() => ellipsis(post?.title ?? '', 80), [post]);
  const description = useMemo(() => {
    const textContent = getTexts(post?.article);
    const cleanText = textContent.replace(/\s+/g, ' ').trim();
    return ellipsis(cleanText, 200);
  }, [post?.article]);

  const shareUrl = useMemo(() => {
    if (post?.shortUrl) {
      return `${Configure.ServiceUrl}${post.shortUrl}`;
    }
    return typeof window !== 'undefined' ? window.location.href : '';
  }, [post?.shortUrl]);

  const structuredData: WithContext<BlogPosting> | undefined = useMemo(
    () =>
      post
        ? {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: title,
            name: title,
            wordCount: post.article.length,
            keywords: ['developer', 'programming', 'w0nder', 'w0nder.land'],
            description,
            dateCreated: DateTime.fromISO(post.createdAt).startOf('second').toISO() ?? undefined,
            dateModified: DateTime.fromISO(post.updatedAt).startOf('second').toISO() ?? undefined,
          }
        : undefined,
    [description, post, title],
  );

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* 포스트 헤더 */}
        <header className="border-b-4 border-black bg-white p-4 md:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <BrutalButton asChild className="px-4 py-2 hover:bg-pink-400 font-black">
                  <Link href="/posts">← BLOG</Link>
                </BrutalButton>
                <BrutalButton asChild className="px-4 py-2 hover:bg-yellow-400 font-black">
                  <Link href="/">HOME</Link>
                </BrutalButton>
              </div>
            </div>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="px-4 md:px-6 py-12">
          <article className="max-w-5xl mx-auto">
            <header>
              <h1 className="font-medium text-3xl">글이 없어요.</h1>
            </header>
          </article>
        </main>

        {/* 푸터 */}
        <footer className="bg-black border-t-4 border-white py-12">
          <p className="text-gray-600 font-black text-sm">© {new Date().getFullYear()} w0nder</p>
        </footer>
      </div>
    );
  }

  return (
    <>
      <HeadContentMeta
        title={title}
        description={description}
        shortUrl={post.shortUrl}
        structuredData={structuredData}
      />

      <div className="min-h-screen bg-gray-100">
        {/* 포스트 헤더 */}
        <header className="border-b-4 border-black bg-white p-4 md:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <BrutalButton asChild className="px-4 py-2 hover:bg-pink-400 font-black">
                  <Link href="/posts">← BLOG</Link>
                </BrutalButton>
                <BrutalButton asChild className="px-4 py-2 hover:bg-yellow-400 font-black">
                  <Link href="/">HOME</Link>
                </BrutalButton>
              </div>
              <BrutalButton
                onClick={() => setIsShareOpen(true)}
                className="px-4 py-2 font-black text-base hover:bg-blue-400">
                <i className="ri-share-line mr-2" />
                SHARE
              </BrutalButton>
            </div>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="px-4 md:px-6 py-12">
          <BlogPostDetail
            title={post.title}
            content={post.article}
            date={postCreatedAt?.toFormat('MMM dd, yyyy').toUpperCase() || ''}
            readTime={getReadTime(post.article)}
            category={getCategoryName(post.category || '', post.tags)}
            accentColor={getCategoryColor(post.category || '', post.tags)}
          />
        </main>

        {/* 푸터 */}
        <footer className="max-w-6xl mx-auto px-4 md:px-6 text-center py-12">
          <p className="text-gray-600 font-black text-sm">© {new Date().getFullYear()} w0nder</p>
        </footer>

        {/* Share Modal */}
        <Share
          title={post.title}
          text={description}
          url={shareUrl}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      </div>
    </>
  );
};

export default PostPage;

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = (params?.slug as string) ?? '';
  const posts = await postReader().listPublished();

  // 폴더 id(uuid)는 하이픈을 포함하지 않는다. 첫 번째 세그먼트가 글 id.
  const uuid = slug.includes('-') ? slug.split('-')[0]! : slug;
  const post = posts.find(it => it.uuid === uuid);

  if (!post) {
    return { notFound: true };
  }

  // slug 는 Next 가 한 번 디코딩한 값이다. 인코딩된 문자열과만 비교하면 정식 주소가 404 가 된다(#15).
  if (!isPostSlugOf(slug, post.uuid, post.title)) {
    return { notFound: true };
  }

  return {
    props: { post },
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await postReader().listPublished();
  const paths = posts.map(post => ({
    // 디코딩된 형태를 넘겨야 getPostUrl 주소(한 번 인코딩)로 prerender 된다.
    params: { slug: getPostRouteParam(post.uuid, post.title) },
  }));

  return {
    paths,
    fallback: 'blocking',
  };
};

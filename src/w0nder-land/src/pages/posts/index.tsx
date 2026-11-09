import { getTexts } from '@/components/editor/utils';
import { BlogCard } from '@/components/ui/BlogCard';
import { BrutalButton } from '@/components/ui/BrutalButton';
import { HeadContentMeta } from '@/components/common/HeadContentMeta';
import { AdSense } from '@/components/common/AdSense';
import { AD_SLOTS, AdFormat, AdSlotType } from '@/constants/ads';
import { Configure } from '@/constants/configure';
import { generateCategories, getCategoryColor, getCategoryName } from '@/libs/utils/category';
import type { Post } from '@/repository/post-types';
import { postReader } from '@/server/post-reader';
import { CONTENT_REVALIDATE_SECONDS } from '@/server/revalidate';
import { DateTime } from 'luxon';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import { useState } from 'react';

function getReadTime(content: string) {
  const charsPerMinute = 400; // 한글 기준 1분에 400자
  const { length } = content.replace(/\s/g, ''); // 공백 제외 글자수
  const minutes = Math.max(1, Math.ceil(length / charsPerMinute));
  return `${minutes}분`;
}

type PostsProps = {
  posts: Post[];
};

const PostsPage = ({ posts }: PostsProps) => {
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // 동적으로 카테고리 생성
  const categories = generateCategories(posts);

  const filteredPosts =
    selectedCategory === 'ALL'
      ? posts
      : posts.filter(post => getCategoryName(post.category || '', post.tags) === selectedCategory);

  return (
    <>
      <HeadContentMeta
        title="블로그 포스트"
        description="w0nder의 개발, 경험, 생각을 담은 블로그 포스트들입니다."
        ogUrl={`${Configure.ServiceUrl}/images/og.png`}
      />

      <div className="min-h-screen bg-gray-100">
        {/* 블로그 헤더 */}
        <header className="border-b-4 border-black bg-white p-4 md:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <BrutalButton asChild className="px-4 py-2 hover:bg-yellow-400 font-black">
                <Link href="/">← HOME</Link>
              </BrutalButton>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 md:px-6 py-12">
          {/* Header */}
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-black text-black mb-4">POSTS</h2>
            <div className="w-32 h-1 bg-black mx-auto" />
          </div>

          {/* Category Filter */}
          <div className="mb-12">
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map(category => (
                <BrutalButton
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`${category.color} px-6 py-2 font-black text-base ${
                    selectedCategory === category.name
                      ? 'shadow-[1px_1px_0px_0px_#000] translate-x-[1px] translate-y-[1px]'
                      : ''
                  }`}>
                  {category.name}
                </BrutalButton>
              ))}
            </div>
          </div>

          {/* 상단 배너 광고 */}
          <div className="mb-12">
            <AdSense
              adSlot={AD_SLOTS[AdSlotType.BANNER]}
              adFormat={AdFormat.HORIZONTAL}
              fullWidthResponsive={false}
              enableLazyLoad
              className="border-4 border-black bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>

          {/* Blog Posts Grid - 모바일 1열, PC 2열 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {filteredPosts.flatMap((post, index) => {
              const textContent = getTexts(post.article);
              const excerpt = `${textContent.replace(/\n\n/g, ' ').substring(0, 150)}...`;

              const items = [
                <BrutalButton
                  key={post.uuid}
                  asChild
                  className="w-full text-left p-0 bg-transparent hover:bg-transparent">
                  <Link href={post.url}>
                    <BlogCard
                      title={post.title}
                      content={post.article}
                      excerpt={excerpt}
                      date={DateTime.fromISO(post.createdAt).toFormat('MMM dd').toUpperCase()}
                      readTime={getReadTime(post.article)}
                      category={getCategoryName(post.category || '', post.tags)}
                      accentColor={getCategoryColor(post.category || '', post.tags)}
                    />
                  </Link>
                </BrutalButton>,
              ];

              // 4개 포스트 후 Display square 광고 (그리드의 직접 자식으로 배치)
              if ((index + 1) % 4 === 0 && index < filteredPosts.length - 1) {
                items.push(
                  <div key={`ad-${post.uuid}`} className="col-span-1 lg:col-span-2 my-8">
                    <AdSense
                      adSlot={AD_SLOTS[AdSlotType.RECTANGLE]}
                      adFormat={AdFormat.AUTO}
                      fullWidthResponsive={false}
                      enableLazyLoad
                      className="border-4 border-black bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    />
                  </div>,
                );
              }

              return items;
            })}
          </div>

          {/* 하단 배너 광고 */}
          <div className="mb-12">
            <AdSense
              adSlot={AD_SLOTS[AdSlotType.BANNER]}
              adFormat={AdFormat.AUTO}
              fullWidthResponsive={false}
              enableLazyLoad
              className="border-4 border-black bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>

          {/* Load More Button */}
          {/* <div className="text-center">
            <BrutalButton className="px-8 py-4 font-black">
              LOAD MORE POSTS
            </BrutalButton>
          </div> */}
        </main>

        {/* 푸터 */}
        <footer className="max-w-6xl mx-auto px-4 md:px-6 text-center py-12">
          <p className="text-gray-600 font-black text-sm">© {new Date().getFullYear()} w0nder</p>
        </footer>
      </div>
    </>
  );
};

export default PostsPage;

export const getStaticProps: GetStaticProps = async () => {
  const posts = await postReader().listPublished();

  return {
    props: { posts },
    revalidate: CONTENT_REVALIDATE_SECONDS,
  };
};

import { HeadContentMeta } from '@/components/common/HeadContentMeta';
import { Share } from '@/components/common/Share';
import { AdSense } from '@/components/common/AdSense';
import { BrutalButton } from '@/components/ui/BrutalButton';
import { AD_SLOTS, AdFormat, AdSlotType } from '@/constants/ads';
import { Configure } from '@/constants/configure';
import { linkStyleOf, socialStyleOf } from '@/libs/site/link-style';
import { isExternalHref } from '@/libs/site/safe-href';
import type { SiteProfile } from '@/repository/site-profile-types';
import { readSiteProfile, siteProfileSourceFromEnv } from '@/server/site-profile-reader';
import { ExternalLink } from 'lucide-react';
import { GetStaticProps } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ProfilePage, WithContext } from 'schema-dts';

type AboutPageProps = { profile: SiteProfile };

const structuredDataOf = (profile: SiteProfile): WithContext<ProfilePage> => ({
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  dateCreated: '2023-11-28T00:00:00+09:00',
  dateModified: '2023-11-28T00:00:00+09:00',
  mainEntity: {
    '@type': 'Person',
    name: profile.name,
    description: profile.bio,
    image: profile.image,
    ...(profile.email ? { email: profile.email } : {}),
  },
});

const AboutPage = ({ profile }: AboutPageProps) => {
  const [isShareOpen, setIsShareOpen] = useState(false);

  const handleShareOpen = useCallback(() => {
    setIsShareOpen(true);
  }, []);

  // sample의 LinkTreeHome과 동일한 구조의 데이터 객체
  const linkTreeData = {
    profile: {
      name: profile.name,
      bio: profile.bio,
      description: profile.description,
      image: profile.image,
    },
    socialLinks: profile.socials.map(social => {
      const style = socialStyleOf(social.key);
      return {
        name: (social.key ?? social.label).toUpperCase(),
        icon: style.icon,
        url: social.url,
        color: style.bg,
        textColor: style.bg.includes('text-white') ? 'text-white' : 'text-black',
      };
    }),
    linkButtons: profile.links.map(link => {
      const style = linkStyleOf(link.key);
      return {
        title: link.label,
        description: link.description,
        icon: style.icon,
        url: link.url,
        color: style.bg,
        isExternal: isExternalHref(link.url),
      };
    }),
  };

  return (
    <>
      <HeadContentMeta
        title="소개"
        description={profile.bio}
        ogUrl={`${Configure.ServiceUrl}/images/og.png`}
        structuredData={structuredDataOf(profile)}
      />

      <div className="min-h-screen bg-gray-100 py-12">
        <div className="max-w-2xl mx-auto px-4 md:px-6">
          {/* Profile Section */}
          <div className="text-center mb-12">
            <div className="relative inline-block mb-6">
              <Image
                alt="profile_image"
                src={linkTreeData.profile.image}
                width="128"
                height="128"
                className="w-32 h-32 border-6 border-black object-cover shadow-[8px_8px_0px_0px_#000]"
              />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-400 border-4 border-black shadow-[2px_2px_0px_0px_#000]" />
            </div>

            <h1 className="text-4xl font-black text-black mb-3">{linkTreeData.profile.name}</h1>

            <p className="text-left text-lg font-black text-gray-600 mb-6 max-w-lg mx-auto leading-relaxed whitespace-pre-line">
              <br />
              {linkTreeData.profile.bio}
              <br />
              <br />
              {linkTreeData.profile.description}
            </p>
          </div>

          {/* Social Links */}
          <div className="mb-12">
            <h2 className="text-lg font-black text-black mb-4 text-center">CONNECT WITH ME</h2>
            <div className="flex justify-center">
              <div className="flex flex-wrap justify-center gap-3">
                {linkTreeData.socialLinks.map(social => (
                  <BrutalButton
                    key={social.name}
                    asChild
                    className={`${social.color} flex items-center justify-center w-12 h-12`}
                    shadowSize="md">
                    <Link href={social.url} target="_blank">
                      <i
                        className={`${social.icon} text-3xl ${social.textColor} group-hover:scale-110 transition-transform`}
                      />
                    </Link>
                  </BrutalButton>
                ))}

                <BrutalButton
                  onClick={handleShareOpen}
                  className="bg-[#F4D738] flex items-center justify-center w-12 h-12"
                  shadowSize="md">
                  <i className="ri-share-line text-3xl text-black group-hover:scale-110 transition-transform" />
                </BrutalButton>
              </div>
            </div>
          </div>

          <div className="my-6">
            <AdSense
              adSlot={AD_SLOTS[AdSlotType.BANNER]}
              adFormat={AdFormat.HORIZONTAL}
              fullWidthResponsive={false}
              enableLazyLoad
              className="border-4 border-black bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>

          {/* Link Buttons */}
          <div className="space-y-4">
            {linkTreeData.linkButtons.map(link => (
              <div key={link.title}>
                <BrutalButton asChild className={`w-full ${link.color} p-5`} shadowSize="lg">
                  <Link href={link.url} target={link.isExternal ? '_blank' : '_self'}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center ">
                        <i className={`${link.icon} text-4xl text-black`} />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-2xl font-black text-black mb-1">{link.title}</h3>
                        <p className="text-base font-medium text-black opacity-80">{link.description}</p>
                      </div>
                      {link.isExternal && (
                        <ExternalLink className="w-5 h-5 text-black group-hover:scale-110 transition-transform flex-shrink-0" />
                      )}
                    </div>
                  </Link>
                </BrutalButton>
              </div>
            ))}
          </div>

          <div className="my-6">
            <AdSense
              adSlot={AD_SLOTS[AdSlotType.BANNER]}
              adFormat={AdFormat.HORIZONTAL}
              fullWidthResponsive={false}
              enableLazyLoad
              className="border-4 border-black bg-white p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>

          <Share
            title="w0nder"
            text={profile.bio}
            url={`${Configure.ServiceUrl}/about`}
            isOpen={isShareOpen}
            onClose={() => setIsShareOpen(false)}
          />

          {/* Footer */}
          <div className="mt-16 text-center">
            <p className="text-gray-600 font-black text-sm">
              © {new Date().getFullYear()} {linkTreeData.profile.name}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export const getStaticProps: GetStaticProps<AboutPageProps> = async () => {
  const profile = await readSiteProfile();
  // 모코 원천이면 1분마다 다시 만든다. 실패하면 Next 가 이전 페이지를 유지한다.
  return { props: { profile }, revalidate: siteProfileSourceFromEnv() === 'mocco' ? 60 : false };
};

export default AboutPage;

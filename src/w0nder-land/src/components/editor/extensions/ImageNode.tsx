import { Image } from '@tiptap/extension-image';
import NextImage from 'next/image';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { safeHref } from '@/libs/site/safe-href';
import type { NodeViewProps } from './types';

type ImageNodeAttrs = {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
};

export const ImageNode = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
      },
      height: {
        default: null,
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CustomImageView);
  },
});

export const CustomImageView = (props: NodeViewProps) => {
  const { node } = props;
  const attrs = node.attrs as ImageNodeAttrs;

  // alt 가 비어도 원문이 가리키는 이미지는 그린다(#20). 빈 alt 는 장식 이미지로 둔다.
  // 외부 원천의 javascript:·data: 주소는 그리지 않는다.
  const src = safeHref(attrs.src ?? '');
  if (!src) {
    return null;
  }

  return (
    <NodeViewWrapper>
      <NextImage
        className="rounded max-w-full h-auto my-0 mx-auto mt-8 border"
        src={src}
        alt={attrs.alt ?? ''}
        width={attrs.width ?? 600}
        height={attrs.height ?? 600}
      />
    </NodeViewWrapper>
  );
};

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { safeHref } from '@/libs/site/safe-href';
import type { NodeViewProps, HTMLAttributes } from './types';

type VideoAttrs = {
  title: string | null;
  url: string | null;
  target: string;
  image: string | null;
};

export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: {
        default: null,
      },
      title: {
        default: null,
      },
      target: {
        default: '_blank',
      },
      image: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'video',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },
});

export const VideoView = (props: NodeViewProps) => {
  const { node } = props;
  const attrs = node.attrs as VideoAttrs;
  const url = safeHref(attrs.url ?? '');

  if (!url) {
    return null;
  }

  return (
    <NodeViewWrapper>
      <div className="w-full overflow-hidden bg-white rounded-lg border border-gray-200">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video controls loop autoPlay className="w-full">
          <source src={url} type="video/mp4" title={attrs.title || undefined} />
          Your browser does not support the video tag.
        </video>
      </div>
    </NodeViewWrapper>
  );
};

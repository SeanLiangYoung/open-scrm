/** Fields consumed by the operation views; optional aliases retain existing display compatibility. */
export interface AuthUser {
  id: number | string;
  username: string;
  corpId: number | string;
}
export interface Tag {
  id: number;
  tagName: string;
  tagType: number;
  tagColor?: string;
  name?: string;
  color?: string;
  tag_type?: number;
  isAuto?: boolean;
  is_auto?: boolean;
  createTime: string;
  create_time?: string;
}
export interface Customer {
  id: number;
  name: string;
  gender: number;
  status: number;
  channel: string;
  mobile?: string;
  email?: string;
  source?: string;
  remark?: string;
  createTime: string;
  create_time?: string;
  tags?: Tag[];
}
export interface FollowUp {
  id: number;
  followType: number;
  content: string;
  createTime: string;
  userId: number;
  nextFollowTime?: string;
  create_time?: string;
  follow_type?: number;
  next_follow_time?: string;
}
export interface SopStep {
  stepName: string;
  stepType: number;
  delayTime: number;
  delayUnit: string;
  actionContent?: {
    text?: string;
    tagName?: string;
    content?: string;
    tagIds?: number[];
    userIds?: number[];
    [key: string]: unknown;
  };
}
export interface SopTemplate {
  id: number;
  templateName: string;
  templateType: number;
  triggerType: number;
  status: number;
  description?: string;
  steps?: SopStep[];
  name?: string;
  type?: string;
  trigger_type?: number;
}
export interface SopExecution {
  id: number;
  templateName: string;
  targetType: number;
  currentStep: number;
  totalSteps: number;
  status: number;
  createTime: string;
  create_time?: string;
}
export interface MessageTemplate {
  id: number;
  templateName: string;
  templateType: number;
  messageType: number;
  content: string;
  status: number;
  name?: string;
  template_name?: string;
  template_type?: number;
  message_type?: number;
}
export interface Notification {
  id: number;
  title: string;
  content: string;
  notificationType: number;
  isRead: boolean;
  createTime: string;
  notification_type?: number;
  create_time?: string;
}
export interface ChannelCode {
  id: number;
  codeName: string;
  channel: string;
  status: number;
  name?: string;
  scanCount?: number;
  scan_count?: number;
  addCount?: number;
  add_count?: number;
}
export interface PlatformAccount {
  id: number;
  platform: string;
  accountName: string;
  status: number;
  account_name?: string;
  followerCount?: number;
  follower_count?: number;
}
export interface MassTask {
  id: number;
  taskName: string;
  taskType: number;
  targetType: number;
  status: number;
  targetCount: number;
  successCount: number;
  failCount: number;
}

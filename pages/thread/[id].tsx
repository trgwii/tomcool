import {
    Alert,
    Divider,
    Loader,
    Text,
    Paper,
    Skeleton,
    Timeline,
    Title,
    TextInput,
    InputWrapper,
    Code,
    Button,
    Group,
    Menu,
    Textarea,
    Tabs,
    Card,
    Tooltip,
    useMantineTheme,
    Badge,
} from "@mantine/core";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
    ChatBubbleIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    CodeIcon,
    CommitIcon,
    Cross1Icon,
    CrossCircledIcon,
    CubeIcon,
    DownloadIcon,
    DrawingPinFilledIcon,
    DrawingPinIcon,
    GlobeIcon,
    PinTopIcon,
} from "@modulz/radix-icons";
import useSWR from "swr";
import { Reply, Thread, ThreadResponse } from "../../models/ThomasForumModels";
import axios from "axios";
import { useNotifications } from "@mantine/notifications";
import RichTextEditor from "../../components/RichTextEditor";
import { ContentRenderer } from "../../components/ContentRenderer";
import { useForm, useLocalStorageValue, useToggle } from "@mantine/hooks";
import { usePins } from "../../lib/pins";
import { useThreadModificationDates } from "../../lib/newThreads";
import { formatDistance } from "date-fns";
import { useModals } from "@mantine/modals";
import { Prism } from "@mantine/prism";
import { colorizeString } from "../../lib/stringToColor";
import { useMantineThemeStyles } from "@mantine/styles/lib/theme/MantineProvider";
import { useSettings } from "../../lib/settings";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const ThreadViewer = (props: {
    id: number;
    thread: Thread;
    reeval?: () => void;
}) => {
    const t = props.thread;
    const notifications = useNotifications();
    const form = useForm({
        initialValues: {
            content: "",
        },
    });

    const [editor, setEditor] = useLocalStorageValue<"plain" | "rich">({
        key: "editor",
        defaultValue: "rich",
    });

    const [loading, setLoading] = useState(false);

    const { addPin, removePin, hasPin } = usePins();

    const [isPinned, setIsPinned] = useState(hasPin(props.id));

    const pinMenuItemClick = () => {
        if (hasPin(props.id)) {
            removePin(props.id);
        } else {
            addPin({
                id: props.id,
                created: t.created,
                title: t.title,
                hash: t.hash,
            });
        }
        setIsPinned(hasPin(props.id));
    };

    const submit = form.onSubmit((values) => {
        setLoading(true);
        axios
            .post("https://forums.trgwii.com/api/thread/post.json", {
                id: props.id,
                text: values.content,
            })
            .then((req) => {
                if (req.data.ok) {
                    form.reset();
                    setLoading(false);
                    if (props.reeval) {
                        props.reeval();
                    }
                } else {
                    setLoading(false);
                    notifications.showNotification({
                        title: "Error",
                        message: req.data.error,
                        color: "red",
                        icon: <Cross1Icon />,
                    });
                }
            })
            .catch((err) => {
                setLoading(false);
                notifications.showNotification({
                    title: "Error",
                    message: err.response?.data?.error
                        ? err.response.data.error
                        : err.message
                        ? err.message
                        : "Failed to submit",
                    color: "red",
                    icon: <Cross1Icon />,
                });
            });
    });

    const mentions = useMemo(
        () => ({
            allowedChars: /^[A-Za-z\sÅÄÖåäö]*$/,
            mentionDenotationChars: ["@"],
            source: (
                searchTerm: string,
                renderList: Function,
                mentionChar: string
            ) => {
                const list = Array.from(new Set(t.replies.map(x => x.hash).reverse())).map((hash, i) => ({
                    id: i + 1,
                    value: hash,
                }));
                const includesSearchTerm = list.filter((item) =>
                    item.value.toLowerCase().includes(searchTerm.toLowerCase())
                );
                renderList(includesSearchTerm);
            },
        }),
        [t]
    );

    const ReplyView = (props: { r: Reply }) => {
        const r = props.r;
        const [collapsed, setCollapsed] = useState(false);
        const {colorizeReply} = useSettings()
        const modals = useModals()
        const {colorScheme} = useMantineTheme()
        const openModal = () => modals.openModal({
            title: 'Raw Content',
            children: <Prism language="markdown">{r.text}</Prism>,
            size: "xl"
        })
        return (
            <Card
                mb={10}
                shadow="sm"
                className="comment-content"
                sx={{ img: { maxWidth: "100%" }, overflowWrap: "anywhere" }}
            >
                <Card.Section
                    sx={(t) => ({
                        background:
                            t.colorScheme === "light"
                                ? t.colors.gray[1]
                                : t.colors.gray[8],
                    })}
                >
                    <Group sx={{ padding: 5 }} spacing="xs">
                        <ChatBubbleIcon style={{ marginLeft: 5}} />
                        <Text color={colorizeReply === "true" ? colorizeString(r.hash, colorScheme) : undefined}>{r.hash}</Text>
                        {r.created && (
                            <Text size="xs">
                                {r.created ? (
                                    <Tooltip label={r.created} withArrow>
                                        {formatDistance(
                                            new Date(r.created),
                                            new Date(),
                                            { addSuffix: true }
                                        )}
                                    </Tooltip>
                                ) : (
                                    ""
                                )}
                            </Text>
                        )}
                        <div style={{ flexGrow: 1 }} />
                        <Button
                            onClick={() => setCollapsed((s) => !s)}
                            color="gray"
                            variant="subtle"
                            size="xs"
                            compact
                        >
                            {collapsed ? (
                                <ChevronDownIcon />
                            ) : (
                                <ChevronUpIcon />
                            )}
                        </Button>
                        <Menu>
                            <Menu.Label>Developer Tools</Menu.Label>
                            <Menu.Item onClick={openModal} icon={<CodeIcon />}>
                                View Raw Content
                            </Menu.Item>
                        </Menu>
                    </Group>
                </Card.Section>
                {!collapsed && (
                    <Card.Section>
                        <div style={{ margin: "0 20px" }}>
                            <ContentRenderer>{r.text}</ContentRenderer>
                        </div>
                    </Card.Section>
                )}
            </Card>
        );
    };

    const replyMemos = useMemo(() => {
        return t.replies.map((r, id) => <ReplyView r={r} key={id} />);
    }, [t]);

    return (
        <>
            <div style={{ display: "flex" }}>
                <Title style={{ flexGrow: 1 }} order={2} mb={10}>
                    {t.title}
                </Title>
                <Badge variant="light" size="lg" mx={5}>{t.hash}</Badge>
                <Menu>
                    <Menu.Label>Recover</Menu.Label>
                    <Menu.Item icon={<CubeIcon />}>Recover from IPFS</Menu.Item>
                    <Menu.Item icon={<GlobeIcon />}>
                        Recover from Internet Archive
                    </Menu.Item>
                    <Divider />
                    <Menu.Label>Storage</Menu.Label>
                    <Menu.Item
                        color="blue"
                        onClick={pinMenuItemClick}
                        icon={
                            isPinned ? (
                                <DrawingPinFilledIcon />
                            ) : (
                                <DrawingPinIcon />
                            )
                        }
                    >
                        {isPinned ? "Unpin" : "Pin"}
                    </Menu.Item>
                    ,
                    <Menu.Item color="lime" icon={<DownloadIcon />}>
                        Save in browser
                    </Menu.Item>
                    ,
                    <Menu.Item color="lime" icon={<CubeIcon />}>
                        Save to IPFS
                    </Menu.Item>
                </Menu>
            </div>
            <Paper
                className="thread-content"
                sx={{ img: { maxWidth: "100%" } }}
                padding="md"
                shadow="sm"
                mb={20}
            >
                <ContentRenderer>{t.text}</ContentRenderer>
            </Paper>
            {/* <Divider mb={20} variant="dashed" /> */}
            {t.replies.length === 0 && (
                <Text>No replies. Be first to reply!</Text>
            )}
            <div style={{ marginBottom: 20 }}>{replyMemos}</div>
            {/* <Divider mb={20} variant="dashed" /> */}
            <Title order={3} mb={5}>
                Post a reply
            </Title>
            <form onSubmit={submit}>
                <InputWrapper
                    mb={10}
                    required
                    label={editor === "rich" ? "Content" : "Content (markdown is supported)"}
                    sx={{
                        ".ql-mention-list-container,.ql-container": {
                            zIndex: 99999,
                        },
                    }}
                >
                    <Tabs>
                        <Tabs.Tab label="Editor">
                            {editor === "rich" && (
                                <RichTextEditor
                                    readOnly={loading}
                                    value={form.values.content}
                                    controls={[
                                        [
                                            "bold",
                                            "italic",
                                            "underline",
                                            "clean",
                                        ],
                                        ["h1", "h2", "h3", "h4", "h5", "h6"],
                                        ["unorderedList", "orderedList"],
                                        [
                                            "link",
                                            "video",
                                            "image",
                                            "blockquote",
                                        ],
                                        ["code", "codeBlock"],
                                        ["sup", "sub"],
                                    ]}
                                    mentions={mentions}
                                    {...form.getInputProps("content")}
                                />
                            )}
                            {editor === "plain" && (
                                <Textarea
                                    autosize
                                    {...form.getInputProps("content")}
                                />
                            )}
                        </Tabs.Tab>
                        <Tabs.Tab label="Preview">
                            <ContentRenderer>
                                {form.values.content}
                            </ContentRenderer>
                        </Tabs.Tab>
                    </Tabs>
                </InputWrapper>

                <Button mr={10} loading={loading} type="submit">
                    Submit
                </Button>

                <Button
                    color="gray"
                    onClick={() =>
                        setEditor((s) => {
                            if(s === 'rich' && form.values.content === "<p><br></p>") {
                                form.setValues({ content: ""})
                            }
                             return (s === "plain" ? "rich" : "plain")
                        })
                    }
                >
                    Use {editor === "plain" ? "Rich" : "Simple"} Editor
                </Button>
            </form>
            <br />
        </>
    );
};

const ContentLoading = (props: {}) => {
    return (
        <>
            <Skeleton height={50} circle mb="xl" />
            <Skeleton height={8} radius="xl" />
            <Skeleton height={8} mt={6} radius="xl" />
            <Skeleton height={8} mt={6} width="70%" radius="xl" />
        </>
    );
};

const Post = () => {
    const router = useRouter();
    const { id } = router.query;
    const { data, error, mutate } = useSWR<ThreadResponse>(
        id && !Array.isArray(id)
            ? `https://forums.trgwii.com/api/thread/${id}`
            : null,
        fetcher
    );
    const { visitNewThread } = useThreadModificationDates();
    useEffect(() => {
        if (
            id &&
            !Array.isArray(id) &&
            !error &&
            data &&
            data.ok &&
            data.thread
        ) {
            visitNewThread(parseInt(id), data.thread.modified);
        }
    }, [id, error, data, visitNewThread]);
    return (
        <>
            {error && (
                <Alert
                    mb={10}
                    icon={<CrossCircledIcon />}
                    title="Error"
                    color="red"
                >
                    There was a problem fetching data, trying again...
                </Alert>
            )}
            {data ? (
                <>
                    {!data.ok && (
                        <Alert
                            icon={<CrossCircledIcon />}
                            title="Error"
                            color="red"
                            mb={10}
                        >
                            {data.error}
                        </Alert>
                    )}
                    {data.ok && (
                        <ThreadViewer
                            id={parseInt(id as string, 10)}
                            thread={data.thread}
                            reeval={() => mutate()}
                        />
                    )}
                </>
            ) : (
                <ContentLoading />
            )}
        </>
    );
};

export default Post;

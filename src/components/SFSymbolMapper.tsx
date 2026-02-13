import React from 'react';
import {
    List,
    Folder,
    Star,
    Calendar,
    User,
    CheckCircle2,
    Flag,
    Tag,
    Briefcase,
    Home,
    Plane,
    ClipboardList,
    ShoppingBag,
    Gift,
    Hash,
    Book,
    Lightbulb,
    Music,
    Camera,
    Video,
    MapPin,
    Heart,
    Smile,
    MessageSquare,
    Phone,
    Mail,
    Settings,
    Bell,
    CreditCard,
    DollarSign,
    PieChart,
    BarChart,
    Activity,
    Zap,
    Coffee,
    Utensils,
    Car,
    Train,
    Bike,
    Anchor,
    Cloud,
    Sun,
    Moon,
    Umbrella,
    Droplets,
    Ghost,
    Gamepad2,
    Dumbbell,
    Trophy,
    Award,
    Target,
    Pencil,
    BadgeCheck,
    Hammer,
    Palette,
    Film,
    GraduationCap,
    Leaf,
    FileText,
    ShoppingCart,
    Users,
    Circle,
    LucideIcon
} from 'lucide-react';

interface SFSymbolMapperProps {
    symbol?: string;
    color?: string;
    className?: string;
    size?: number;
    style?: React.CSSProperties;
}

const sfSymbolMap: Record<string, LucideIcon> = {
    // General
    'list.bullet': List,
    'list.clipboard': ClipboardList,
    'folder': Folder,
    'star': Star,
    'star.fill': Star,
    'calendar': Calendar,
    'person': User,
    'person.fill': User,
    'checkmark.circle': CheckCircle2,
    'flag': Flag,
    'tag': Tag,
    'number': Hash,

    // Objects & Categories
    'briefcase': Briefcase,
    'briefcase.fill': Briefcase,
    'house': Home,
    'house.fill': Home,
    'airplane': Plane,
    'cart': ShoppingCart,
    'cart.fill': ShoppingCart,
    'gift': Gift,
    'gift.fill': Gift,
    'book': Book,
    'book.closed': Book,
    'lightbulb': Lightbulb,
    'lightbulb.fill': Lightbulb,
    'music.note': Music,
    'camera': Camera,
    'video': Video,
    'mappin': MapPin,
    'mappin.and.ellipse': MapPin,

    // Emotions & Communication
    'heart': Heart,
    'heart.fill': Heart,
    'smiley': Smile,
    'message': MessageSquare,
    'phone': Phone,
    'envelope': Mail,

    // System
    'gear': Settings,
    'bell': Bell,
    'creditcard': CreditCard,
    'dollarsign.circle': DollarSign,

    // Data & Activity
    'chart.pie': PieChart,
    'chart.bar': BarChart,
    'waveform.path.ecg': Activity,
    'bolt': Zap,
    'bolt.fill': Zap,

    // Lifestyle
    'cup.and.saucer': Coffee,
    'fork.knife': Utensils,
    'car': Car,
    'tram': Train,
    'bicycle': Bike,
    'ferry': Anchor,

    // Weather & Nature
    'cloud': Cloud,
    'sun.max': Sun,
    'moon': Moon,
    'umbrella': Umbrella,
    'drop': Droplets,

    // Misc
    'gamecontroller': Gamepad2,
    'dumbbell': Dumbbell,
    'trophy': Trophy,
    'rosette': Award,
    'target': Target,

    // iOS Specific Mappings
    '1.circle.fill': Circle,
    '2.circle.fill': Circle,
    '3.circle.fill': Circle,
    '4.circle.fill': Circle,
    'pencil': Pencil,
    'checkmark.seal': BadgeCheck,
    'folder.fill': Folder,
    'gearshape.fill': Settings,
    'hammer.fill': Hammer,
    'paintpalette': Palette,
    'film': Film,
    'book.fill': Book,
    'graduationcap.fill': GraduationCap,
    'leaf.fill': Leaf,
    'car.fill': Car,
    'airplane.circle.fill': Plane,
    'gamecontroller.fill': Gamepad2,
    'cup.and.saucer.fill': Coffee,
    'dollarsign.circle.fill': DollarSign,
    'doc.fill': FileText,
    'person.2.fill': Users
};

export const SFSymbolMapper: React.FC<SFSymbolMapperProps> = ({
    symbol,
    color,
    className = "",
    size = 20,
    style = {}
}) => {
    // Determine the icon to render
    const IconComponent = (symbol && sfSymbolMap[symbol])
        ? sfSymbolMap[symbol]
        : List; // Default to List if symbol not found or undefined

    // Determine color style
    const iconStyle: React.CSSProperties = {
        ...style,
        ...(color ? { color } : {})
    };

    return (
        <IconComponent
            size={size}
            className={className}
            style={iconStyle}
        />
    );
};

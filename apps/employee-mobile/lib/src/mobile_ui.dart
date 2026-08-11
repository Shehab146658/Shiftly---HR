import 'package:flutter/material.dart';

class ShiftlyBrand extends StatelessWidget {
  const ShiftlyBrand({super.key, this.compact = false});
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: compact ? 36 : 44,
          height: compact ? 36 : 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(compact ? 12 : 15),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF315BEA), Color(0xFF7A5AF8)],
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33315BEA),
                blurRadius: 14,
                offset: Offset(0, 6),
              ),
            ],
          ),
          child: const Icon(Icons.sync_alt_rounded, color: Colors.white),
        ),
        const SizedBox(width: 11),
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'SHIFTLY',
              style: TextStyle(
                color: Color(0xFF15213D),
                fontSize: 16,
                fontWeight: FontWeight.w900,
                letterSpacing: 2.2,
              ),
            ),
            Text(
              'PEOPLE OPERATIONS',
              style: TextStyle(
                color: Color(0xFF7A8497),
                fontSize: 7,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.25,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class PageMessage extends StatelessWidget {
  const PageMessage({
    super.key,
    required this.icon,
    required this.title,
    this.body,
    this.action,
  });
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(22),
              ),
              child: Icon(
                icon,
                size: 31,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            if (body != null) ...[
              const SizedBox(height: 8),
              Text(
                body!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF687386), height: 1.45),
              ),
            ],
            if (action != null) ...[const SizedBox(height: 20), action!],
          ],
        ),
      ),
    );
  }
}

Color statusColor(String status) {
  return switch (status) {
    'approved' ||
    'published' ||
    'valid' ||
    'completed' => const Color(0xFF15845B),
    'rejected' || 'cancelled' => const Color(0xFFC43D4B),
    'in_review' || 'submitted' || 'pending_review' => const Color(0xFFB26B13),
    _ => const Color(0xFF50617E),
  };
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.label, {super.key});
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = statusColor(label);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.replaceAll('_', ' '),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from academics.models import Subject, AttendanceLog, Marks, Backlog
from timetable.models import Room, TimeSlot, TimetableEntry
from fees.models import FeeRecord
from library.models import LibraryBook
from users.models import StudentProfile, FacultyProfile, ParentProfile
from datetime import date, time, timedelta
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds the database with demo data for all three user roles.'

    def handle(self, *args, **kwargs):
        self.stdout.write('🌱 Seeding database...')

        # --- Admin user ---
        admin, _ = User.objects.get_or_create(
            username='admin',
            defaults={'email': 'admin@an.edu', 'role': 'admin', 'first_name': 'Admin', 'last_name': 'Faculty'}
        )
        admin.set_password('admin123')
        admin.save()

        faculty_user, _ = User.objects.get_or_create(
            username='dr.sharma',
            defaults={'email': 'sharma@an.edu', 'role': 'faculty', 'first_name': 'Dr. Priya', 'last_name': 'Sharma'}
        )
        faculty_user.set_password('faculty123')
        faculty_user.save()
        faculty_profile, _ = FacultyProfile.objects.get_or_create(
            user=faculty_user,
            defaults={'department': 'Computer Science', 'max_hours_per_week': 20}
        )

        # --- Student ---
        student_user, _ = User.objects.get_or_create(
            username='nithin2025',
            defaults={'email': 'nithin@student.an.edu', 'role': 'student', 'first_name': 'Nithin', 'last_name': 'Kumar'}
        )
        student_user.set_password('student123')
        student_user.save()

        student_profile, _ = StudentProfile.objects.get_or_create(
            user=student_user,
            defaults={'student_id': 'CS2025001', 'department': 'Computer Science', 'semester': 4}
        )

        # --- Parent ---
        parent_user, _ = User.objects.get_or_create(
            username='parent.nithin',
            defaults={'email': 'parent@an.edu', 'role': 'parent', 'first_name': 'Ravi', 'last_name': 'Kumar'}
        )
        parent_user.set_password('parent123')
        parent_user.save()
        ParentProfile.objects.get_or_create(
            user=parent_user,
            defaults={'linked_student': student_profile}
        )
        student_profile.parent_user = parent_user
        student_profile.save()

        # --- Subjects ---
        subjects_data = [
            ('CS401', 'Data Structures', 4, 3),
            ('CS402', 'Operating Systems', 4, 4),
            ('CS403', 'Database Management', 4, 3),
            ('CS404', 'Computer Networks', 4, 3),
            ('CS405', 'Software Engineering', 4, 2),
        ]
        subjects = []
        for code, name, sem, credits in subjects_data:
            s, _ = Subject.objects.get_or_create(
                code=code,
                defaults={'name': name, 'semester': sem, 'credits': credits, 'faculty': faculty_profile}
            )
            subjects.append(s)

        # --- Marks ---
        grades = ['O', 'A+', 'A', 'B+', 'B']
        for subj in subjects:
            internal = random.uniform(20, 40)
            external = random.uniform(40, 60)
            Marks.objects.get_or_create(
                student=student_profile, subject=subj,
                exam_year=2025, exam_month=11,
                defaults={'internal': round(internal, 1), 'external': round(external, 1)}
            )

        # --- Attendance ---
        today = date.today()
        for subj in subjects:
            for i in range(30):
                d = today - timedelta(days=i)
                status = 'present' if random.random() > 0.25 else 'absent'
                AttendanceLog.objects.get_or_create(
                    student=student_profile, subject=subj, date=d,
                    defaults={'status': status}
                )

        # --- Backlog ---
        Backlog.objects.get_or_create(
            student=student_profile, subject=subjects[0],
            defaults={'exam_date': date(2025, 4, 15), 'cleared': False}
        )

        # --- Fees ---
        FeeRecord.objects.get_or_create(
            student=student_profile, semester=4,
            defaults={'amount_due': 45000, 'amount_paid': 20000, 'due_date': date(2025, 4, 1)}
        )

        # --- Rooms ---
        rooms_data = [('Room 101', 60, False), ('Room 102', 60, False), ('Lab A', 30, True)]
        rooms = []
        for name, cap, is_lab in rooms_data:
            r, _ = Room.objects.get_or_create(name=name, defaults={'capacity': cap, 'is_lab': is_lab})
            rooms.append(r)

        # --- TimeSlots ---
        periods = [
            (time(9, 0), time(10, 0)),
            (time(10, 0), time(11, 0)),
            (time(11, 15), time(12, 15)),
            (time(14, 0), time(15, 0)),
            (time(15, 0), time(16, 0)),
        ]
        timeslots = []
        for day in range(5):  # Mon–Fri
            for period_idx, (st, et) in enumerate(periods):
                ts, _ = TimeSlot.objects.get_or_create(
                    day=day, period=period_idx + 1,
                    defaults={'start_time': st, 'end_time': et}
                )
                timeslots.append(ts)

        # --- Library ---
        books_data = [
            ('Introduction to Algorithms', 'Cormen et al.', '978-0-262-03384-8', 5, 3),
            ('Operating System Concepts', 'Silberschatz', '978-0-470-12872-5', 4, 2),
            ('Database System Concepts', 'Silberschatz', '978-0-073-52& 317-7', 3, 1),
            ('Computer Networks', 'Tanenbaum', '978-0-132-12695-3', 6, 4),
        ]
        for title, author, isbn, total, avail in books_data:
            LibraryBook.objects.get_or_create(
                isbn=isbn,
                defaults={'title': title, 'author': author, 'total_copies': total, 'available_copies': avail}
            )

        self.stdout.write(self.style.SUCCESS('✅ Seed complete!'))
        self.stdout.write('  Admin:   admin / admin123')
        self.stdout.write('  Student: nithin2025 / student123')
        self.stdout.write('  Parent:  parent.nithin / parent123')

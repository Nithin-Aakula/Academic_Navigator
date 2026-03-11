import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'AN_app.settings')
django.setup()

from timetable.models import ConstraintConfig, TimeSlot, Room
from academics.models import Subject
from users.models import FacultyProfile, CustomUser
from timetable.ga_engine import run_ga

def setup_environment():
    print("Setting up simulation environment...")
    # Clear existing constraints for smooth testing
    TimeSlot.objects.all().delete()
    Room.objects.all().delete()
    Subject.objects.all().delete()
    FacultyProfile.objects.all().delete()
    CustomUser.objects.filter(role='faculty').delete()

    # Create 100 slots (e.g. 5 days * 20 periods, or 5 days * 10 periods * 2 rooms, etc)
    # Let's do 5 days * 10 periods = 50 slots per room. We'll use 2 rooms to make it 100.
    print("Creating 50 timeslots...")
    for day in range(5): # Mon-Fri
        for p in range(1, 11): # 1-10
            TimeSlot.objects.create(day=day, period=p, start_time=f"{8+p}:00:00", end_time=f"{9+p}:00:00")
    
    print("Creating 2 rooms...")
    r1 = Room.objects.create(name="SimLab 1", capacity=60, is_lab=True)
    r2 = Room.objects.create(name="SimClass 2", capacity=60, is_lab=False)

    print("Creating 5 faculty...")
    faculties = []
    for i in range(5):
        u = CustomUser.objects.create_user(username=f'sim_fac_{i}', password='pw', role='faculty', first_name=f"F{i}")
        faculties.append(FacultyProfile.objects.create(user=u, department="CS", max_hours_per_week=20, specialization_tags="#Sim"))

    print("Creating 10 subjects requiring 4 credits each = 40 hours total...")
    for i in range(10):
        Subject.objects.create(code=f"SIM10{i}", name=f"Subject {i}", faculty=faculties[i%5], semester=1, max_students=60, credits=4)

    print("Checking Capacity Ratio:")
    total_req = sum(s.credits for s in Subject.objects.all())
    total_fac = sum(f.max_hours_per_week for f in FacultyProfile.objects.all())
    print(f"Total Required Hours: {total_req}, Total Faculty Hours: {total_fac}, Ratio: {total_req/total_fac:.2f}")

def verify_no_overlaps():
    # Will use the GA engine
    # In older GA it just outputs dicts. If the newer one uses true CSP we need to check conflicts.
    print("Running GA...")
    # Passing semesters=[1] since all our sim subjects are semester 1
    # We will pass mock request to run_ga so it proceeds
    
    # We will adjust constraint config
    conf = ConstraintConfig.get_config()
    conf.mutation_rate = 0.15
    conf.save()
    
    try:
        timetable, conflict_score, gens = run_ga(semesters=[1], max_generations=50)
        
        print(f"GA Finished with Conflict Score: {conflict_score} in {gens} generations.")
        
        # Verify Overlaps
        schedule_map = {}
        for entry in timetable:
            slot_id = entry['timeslot_id']
            room_id = entry['room_id']
            fac_id = entry['faculty_id']
            
            # Key 1: Room overlap
            rk = f"R_{room_id}_{slot_id}"
            if rk in schedule_map:
                print(f"FATAL: Room {room_id} has double booking at slot {slot_id}!")
                return False
            schedule_map[rk] = True
            
            # Key 2: Faculty overlap
            fk = f"F_{fac_id}_{slot_id}"
            if fk in schedule_map:
                print(f"FATAL: Faculty {fac_id} has double booking at slot {slot_id}!")
                return False
            schedule_map[fk] = True

        if conflict_score > 0:
            print("Tests FAILED: Conflict score > 0 indicating soft/hard overlaps.")
            return False
            
        print("PASS: Verified 100-slot simulation yielded 0 overlaps.")
        return True
    except Exception as e:
        print(f"Error during GA execution: {e}")
        return False

if __name__ == "__main__":
    setup_environment()
    verify_no_overlaps()
